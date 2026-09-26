import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, type SQL } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { Status } from "@/lib/constants";
import type { IssueDTO } from "@/lib/types";
import type { Executor } from "../db/client";
import { events, issueLabels, issues, labels, memberships, type IssueRow } from "../db/schema";
import { BadRequest, NotFound } from "../errors";

export function toIssueDTO(row: IssueRow, workspaceKey: string, labelIds: string[]): IssueDTO {
  return {
    id: row.id,
    number: row.number,
    identifier: `${workspaceKey}-${row.number}`,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    priority: row.priority,
    assigneeId: row.assigneeId,
    creatorId: row.creatorId,
    updatedById: row.updatedById,
    labelIds,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function labelIdsFor(db: Executor, issueId: string): Promise<string[]> {
  const rows = await db.select({ id: issueLabels.labelId }).from(issueLabels).where(eq(issueLabels.issueId, issueId));
  return rows.map((r) => r.id).sort();
}

export async function getIssueRow(db: Executor, issueId: string, opts: { includeDeleted?: boolean } = {}) {
  const where = opts.includeDeleted ? eq(issues.id, issueId) : and(eq(issues.id, issueId), isNull(issues.deletedAt));
  const [row] = await db.select().from(issues).where(where);
  if (!row) throw new NotFound("Issue not found");
  return row;
}

export async function appendEvent(
  db: Executor,
  e: {
    workspaceId: string;
    actorId: string | null;
    type: string;
    issueId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    meta?: Record<string, unknown> | null;
  },
): Promise<number> {
  const [row] = await db
    .insert(events)
    .values({
      workspaceId: e.workspaceId,
      actorId: e.actorId,
      type: e.type,
      issueId: e.issueId ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
      meta: e.meta ?? null,
    })
    .returning({ id: events.id });
  return row.id;
}

/** Assignee (if any) must be a member of the workspace. */
export async function assertAssignable(db: Executor, workspaceId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const [m] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, assigneeId)));
  if (!m) throw new BadRequest("Assignee is not a member of this workspace");
}

export async function assertLabels(db: Executor, workspaceId: string, labelIds: string[] | undefined) {
  if (!labelIds?.length) return;
  const found = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, labelIds)));
  if (found.length !== new Set(labelIds).size) throw new BadRequest("Unknown label");
}

// ---------------------------------------------------------------------------
// Ordering (fractional indexing)
// ---------------------------------------------------------------------------

type Column = { workspaceId: string; status: Status; excludeId?: string };

function columnWhere(c: Column, extra?: SQL) {
  return and(
    eq(issues.workspaceId, c.workspaceId),
    eq(issues.status, c.status),
    isNull(issues.deletedAt),
    c.excludeId ? ne(issues.id, c.excludeId) : undefined,
    extra,
  );
}

async function positionOf(db: Executor, c: Column, id: string | null | undefined) {
  if (!id || id === c.excludeId) return null;
  const [row] = await db
    .select({ position: issues.position })
    .from(issues)
    .where(columnWhere(c, eq(issues.id, id)));
  return row?.position ?? null;
}

async function firstIn(db: Executor, c: Column, extra?: SQL) {
  const [row] = await db
    .select({ position: issues.position })
    .from(issues)
    .where(columnWhere(c, extra))
    .orderBy(asc(issues.position))
    .limit(1);
  return row?.position ?? null;
}

async function lastIn(db: Executor, c: Column, extra?: SQL) {
  const [row] = await db
    .select({ position: issues.position })
    .from(issues)
    .where(columnWhere(c, extra))
    .orderBy(desc(issues.position))
    .limit(1);
  return row?.position ?? null;
}

/**
 * Computes an order key for placing an issue in a column.
 *
 * The client names the neighbours it saw (afterId = the card above, beforeId =
 * the card below), but its view may be stale. We anchor on whichever neighbour
 * still exists in that column and take the *current* adjacent key from the
 * database, so the result is always strictly between two real keys.
 * No neighbours -> top of the column.
 */
export async function positionFor(
  db: Executor,
  c: Column,
  neighbours: { afterId?: string | null; beforeId?: string | null } = {},
): Promise<string> {
  let lower = await positionOf(db, c, neighbours.afterId);
  let upper: string | null;
  if (lower !== null) {
    upper = await firstIn(db, c, gt(issues.position, lower));
  } else {
    upper = await positionOf(db, c, neighbours.beforeId);
    if (upper !== null) lower = await lastIn(db, c, lt(issues.position, upper));
    else upper = await firstIn(db, c);
  }
  return generateKeyBetween(lower, upper);
}
