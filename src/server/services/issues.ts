import { and, asc, eq, sql } from "drizzle-orm";
import { UNDO_WINDOW_MS, UNDOABLE_EVENTS, type Status } from "@/lib/constants";
import { CreateIssueInput, MoveIssueInput, UpdateIssueInput } from "@/lib/schemas";
import type { IssueMutationResult } from "@/lib/types";
import { requireRole, requireWorkspace } from "../authz";
import type { Ctx } from "../ctx";
import type { Executor, Tx } from "../db/client";
import { events, githubLinks, issueLabels, issues, workspaces, type IssueRow } from "../db/schema";
import { BadRequest, Conflict, Forbidden, NotFound } from "../errors";
import {
  appendEvent,
  assertAssignable,
  assertLabels,
  getIssueRow,
  labelIdsFor,
  positionFor,
  toIssueDTO,
} from "./shared";

async function workspaceKey(db: Executor, workspaceId: string) {
  const [w] = await db.select({ key: workspaces.key }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return w.key;
}

async function currentDTO(db: Executor, issueId: string) {
  const row = await getIssueRow(db, issueId, { includeDeleted: true });
  return toIssueDTO(row, await workspaceKey(db, row.workspaceId), await labelIdsFor(db, row.id));
}

async function conflict(db: Executor, issueId: string): Promise<never> {
  throw new Conflict("This issue was changed by someone else. Your view has been refreshed.", {
    current: await currentDTO(db, issueId),
  });
}

async function setLabels(tx: Tx, issueId: string, labelIds: string[]) {
  await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (labelIds.length) await tx.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
}

// ---------------------------------------------------------------------------

export async function createIssue(ctx: Ctx, slug: string, input: unknown): Promise<IssueMutationResult> {
  const { workspace } = await requireWorkspace(ctx, slug, "member");
  const data = CreateIssueInput.parse(input);
  await assertAssignable(ctx.db, workspace.id, data.assigneeId);
  await assertLabels(ctx.db, workspace.id, data.labelIds);

  return ctx.db.transaction(async (tx) => {
    // Row lock on the workspace serialises numbering: no two issues get the same number.
    const [{ number }] = await tx
      .update(workspaces)
      .set({ issueCounter: sql`${workspaces.issueCounter} + 1` })
      .where(eq(workspaces.id, workspace.id))
      .returning({ number: workspaces.issueCounter });

    const position = await positionFor(tx, { workspaceId: workspace.id, status: data.status });
    const [row] = await tx
      .insert(issues)
      .values({
        workspaceId: workspace.id,
        number,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        position,
        creatorId: ctx.userId,
        updatedById: ctx.userId,
      })
      .returning();
    const labelIds = [...new Set(data.labelIds)].sort();
    await setLabels(tx, row.id, labelIds);

    const eventId = await appendEvent(tx, {
      workspaceId: workspace.id,
      actorId: ctx.userId,
      type: "issue.created",
      issueId: row.id,
      after: { title: row.title, status: row.status, priority: row.priority, version: row.version },
    });
    return { issue: toIssueDTO(row, workspace.key, labelIds), eventId };
  });
}

export async function getIssue(ctx: Ctx, issueId: string) {
  const row = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, row.workspaceId, "viewer");
  const [issue, links] = await Promise.all([
    currentDTO(ctx.db, issueId),
    ctx.db.select().from(githubLinks).where(eq(githubLinks.issueId, issueId)).orderBy(asc(githubLinks.createdAt)),
  ]);
  return {
    issue,
    githubLinks: links.map((l) => ({
      repo: l.repoFullName,
      number: l.prNumber,
      title: l.prTitle,
      url: l.prUrl,
      state: l.state,
    })),
  };
}

const EDITABLE = ["title", "description", "priority", "assigneeId"] as const;

export async function updateIssue(ctx: Ctx, issueId: string, input: unknown): Promise<IssueMutationResult> {
  const data = UpdateIssueInput.parse(input);
  const issue = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, issue.workspaceId, "member");
  await assertAssignable(ctx.db, issue.workspaceId, data.assigneeId);
  await assertLabels(ctx.db, issue.workspaceId, data.labelIds);
  const key = await workspaceKey(ctx.db, issue.workspaceId);

  return ctx.db.transaction(async (tx) => {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const patch: Partial<IssueRow> = {};
    for (const field of EDITABLE) {
      const next = data[field];
      if (next !== undefined && next !== issue[field]) {
        before[field] = issue[field];
        after[field] = next;
        Object.assign(patch, { [field]: next });
      }
    }
    const oldLabels = await labelIdsFor(tx, issueId);
    const newLabels = data.labelIds ? [...new Set(data.labelIds)].sort() : oldLabels;
    const labelsChanged = newLabels.join() !== oldLabels.join();
    if (labelsChanged) {
      before.labelIds = oldLabels;
      after.labelIds = newLabels;
    }
    if (!Object.keys(after).length) {
      if (issue.version !== data.baseVersion) await conflict(tx, issueId);
      throw new BadRequest("Nothing changed");
    }

    const [row] = await tx
      .update(issues)
      .set({ ...patch, version: sql`${issues.version} + 1`, updatedAt: new Date(), updatedById: ctx.userId })
      .where(and(eq(issues.id, issueId), eq(issues.version, data.baseVersion)))
      .returning();
    if (!row) return conflict(tx, issueId);
    if (labelsChanged) await setLabels(tx, issueId, newLabels);

    before.version = issue.version;
    after.version = row.version;
    const eventId = await appendEvent(tx, {
      workspaceId: issue.workspaceId,
      actorId: ctx.userId,
      type: "issue.updated",
      issueId,
      before,
      after,
    });
    return { issue: toIssueDTO(row, key, newLabels), eventId };
  });
}

/** Shared by user moves and the GitHub integration (actorId = null). */
export async function applyMove(
  tx: Tx,
  issue: IssueRow,
  target: { status: Status; afterId?: string | null; beforeId?: string | null; baseVersion?: number },
  actorId: string | null,
  meta?: Record<string, unknown>,
) {
  const position = await positionFor(
    tx,
    { workspaceId: issue.workspaceId, status: target.status, excludeId: issue.id },
    target,
  );
  const baseVersion = target.baseVersion ?? issue.version;
  const [row] = await tx
    .update(issues)
    .set({
      status: target.status,
      position,
      version: sql`${issues.version} + 1`,
      updatedAt: new Date(),
      updatedById: actorId,
    })
    .where(and(eq(issues.id, issue.id), eq(issues.version, baseVersion)))
    .returning();
  if (!row) return conflict(tx, issue.id);

  const eventId = await appendEvent(tx, {
    workspaceId: issue.workspaceId,
    actorId,
    type: "issue.moved",
    issueId: issue.id,
    before: { status: issue.status, position: issue.position, version: issue.version },
    after: { status: row.status, position: row.position, version: row.version },
    meta,
  });
  return { row, eventId };
}

export async function moveIssue(ctx: Ctx, issueId: string, input: unknown): Promise<IssueMutationResult> {
  const data = MoveIssueInput.parse(input);
  const issue = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, issue.workspaceId, "member");
  const key = await workspaceKey(ctx.db, issue.workspaceId);

  return ctx.db.transaction(async (tx) => {
    const { row, eventId } = await applyMove(tx, issue, data, ctx.userId);
    return { issue: toIssueDTO(row, key, await labelIdsFor(tx, issueId)), eventId };
  });
}

export async function deleteIssue(ctx: Ctx, issueId: string): Promise<IssueMutationResult> {
  const issue = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, issue.workspaceId, "admin");
  const key = await workspaceKey(ctx.db, issue.workspaceId);

  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .update(issues)
      .set({ deletedAt: new Date(), version: sql`${issues.version} + 1`, updatedAt: new Date(), updatedById: ctx.userId })
      .where(eq(issues.id, issueId))
      .returning();
    const eventId = await appendEvent(tx, {
      workspaceId: issue.workspaceId,
      actorId: ctx.userId,
      type: "issue.deleted",
      issueId,
      before: { deleted: false, version: issue.version },
      after: { deleted: true, version: row.version },
    });
    return { issue: toIssueDTO(row, key, await labelIdsFor(tx, issueId)), eventId };
  });
}

// ---------------------------------------------------------------------------
// Undo: re-apply an event's `before` state as a new, version-checked write.
// ---------------------------------------------------------------------------

export async function undoEvent(ctx: Ctx, eventId: number): Promise<IssueMutationResult & { deleted: boolean }> {
  const [ev] = await ctx.db.select().from(events).where(eq(events.id, eventId));
  if (!ev || !ev.issueId) throw new NotFound("Event not found");
  await requireRole(ctx, ev.workspaceId, "member");
  if (ev.actorId !== ctx.userId) throw new Forbidden("You can only undo your own changes");
  if (!(UNDOABLE_EVENTS as readonly string[]).includes(ev.type)) throw new BadRequest("This change can't be undone");
  if (Date.now() - ev.createdAt.getTime() > UNDO_WINDOW_MS) throw new BadRequest("That change is too old to undo");

  const [already] = await ctx.db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.type, "issue.undone"), sql`${events.meta}->>'undoOf' = ${String(ev.id)}`));
  if (already) throw new BadRequest("Already undone");

  const before = ev.before ?? {};
  const after = ev.after ?? {};
  const key = await workspaceKey(ctx.db, ev.workspaceId);
  const issueId = ev.issueId;

  return ctx.db.transaction(async (tx) => {
    const issue = await getIssueRow(tx, issueId, { includeDeleted: true });
    if (issue.version !== after.version) {
      throw new Conflict("The issue has changed since, so this can't be undone.", { current: await currentDTO(tx, issueId) });
    }

    const patch: Partial<IssueRow> = {};
    if (ev.type === "issue.updated") {
      for (const field of EDITABLE) if (field in before) Object.assign(patch, { [field]: before[field] });
      if (Array.isArray(before.labelIds)) await setLabels(tx, issueId, before.labelIds as string[]);
    } else if (ev.type === "issue.moved") {
      patch.status = before.status as Status;
      patch.position = before.position as string;
    } else if (ev.type === "issue.deleted") {
      patch.deletedAt = null;
    }

    const [row] = await tx
      .update(issues)
      .set({ ...patch, version: sql`${issues.version} + 1`, updatedAt: new Date(), updatedById: ctx.userId })
      .where(and(eq(issues.id, issueId), eq(issues.version, issue.version)))
      .returning();
    if (!row) return conflict(tx, issueId);

    const newEventId = await appendEvent(tx, {
      workspaceId: ev.workspaceId,
      actorId: ctx.userId,
      type: "issue.undone",
      issueId,
      before: { ...after, version: issue.version },
      after: { ...before, version: row.version },
      meta: { undoOf: ev.id, undoneType: ev.type },
    });
    return {
      issue: toIssueDTO(row, key, await labelIdsFor(tx, issueId)),
      eventId: newEventId,
      deleted: row.deletedAt !== null,
    };
  });
}
