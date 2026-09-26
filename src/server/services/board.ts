import { and, asc, desc, eq, ilike, isNull, lt, or } from "drizzle-orm";
import type { BoardDTO, CommentDTO, EventDTO, SearchResultDTO } from "@/lib/types";
import { CreateCommentInput, CreateLabelInput } from "@/lib/schemas";
import { requireRole, requireWorkspace } from "../authz";
import type { Ctx } from "../ctx";
import { comments, events, issueLabels, issues, labels, memberships, users } from "../db/schema";
import { Conflict } from "../errors";
import { appendEvent, getIssueRow, toIssueDTO } from "./shared";

/**
 * Everything the board needs in one payload: issues, members and labels.
 * v1: a handful of straightforward queries; Round 2 collapses these and adds indexes.
 */
export async function getBoard(ctx: Ctx, slug: string): Promise<BoardDTO> {
  const { workspace, role } = await requireWorkspace(ctx, slug, "viewer");

  const [issueRows, labelLinks, memberRows, labelRows] = await Promise.all([
    ctx.db
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, workspace.id), isNull(issues.deletedAt)))
      .orderBy(asc(issues.position), asc(issues.id)),
    ctx.db
      .select({ issueId: issueLabels.issueId, labelId: issueLabels.labelId })
      .from(issueLabels)
      .innerJoin(issues, eq(issues.id, issueLabels.issueId))
      .where(eq(issues.workspaceId, workspace.id)),
    ctx.db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspace.id))
      .orderBy(asc(users.name)),
    ctx.db.select().from(labels).where(eq(labels.workspaceId, workspace.id)).orderBy(asc(labels.name)),
  ]);

  const byIssue = new Map<string, string[]>();
  for (const l of labelLinks) {
    const list = byIssue.get(l.issueId) ?? [];
    list.push(l.labelId);
    byIssue.set(l.issueId, list);
  }

  return {
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name, key: workspace.key },
    role,
    me: { id: ctx.userId },
    members: memberRows,
    labels: labelRows.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    issues: issueRows.map((r) => toIssueDTO(r, workspace.key, (byIssue.get(r.id) ?? []).sort())),
  };
}

/** v1 search: case-insensitive substring match on titles, plus direct "KEY-123" lookup. */
export async function searchIssues(ctx: Ctx, slug: string, q: string): Promise<SearchResultDTO[]> {
  const { workspace } = await requireWorkspace(ctx, slug, "viewer");
  const query = q.trim().slice(0, 100);
  if (!query) return [];

  const idMatch = query.match(/^(?:([a-z][a-z0-9]*)-)?(\d+)$/i);
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const conditions = [ilike(issues.title, `%${escaped}%`)];
  if (idMatch && (!idMatch[1] || idMatch[1].toUpperCase() === workspace.key)) {
    conditions.push(eq(issues.number, Number(idMatch[2])));
  }

  const rows = await ctx.db
    .select()
    .from(issues)
    .where(and(eq(issues.workspaceId, workspace.id), isNull(issues.deletedAt), or(...conditions)))
    .orderBy(desc(issues.updatedAt))
    .limit(20);

  return rows.map((r) => ({
    kind: "issue" as const,
    issueId: r.id,
    identifier: `${workspace.key}-${r.number}`,
    title: r.title,
    status: r.status,
  }));
}

export async function listEvents(
  ctx: Ctx,
  slug: string,
  opts: { issueId?: string; before?: number; limit?: number } = {},
): Promise<EventDTO[]> {
  const { workspace } = await requireWorkspace(ctx, slug, "viewer");
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const rows = await ctx.db
    .select({ e: events, number: issues.number, title: issues.title })
    .from(events)
    .leftJoin(issues, eq(issues.id, events.issueId))
    .where(
      and(
        eq(events.workspaceId, workspace.id),
        opts.issueId ? eq(events.issueId, opts.issueId) : undefined,
        opts.before ? lt(events.id, opts.before) : undefined,
      ),
    )
    .orderBy(desc(events.id))
    .limit(limit);

  return rows.map(({ e, number, title }) => ({
    id: e.id,
    type: e.type,
    actorId: e.actorId,
    issueId: e.issueId,
    issueIdentifier: number != null ? `${workspace.key}-${number}` : null,
    issueTitle: title,
    before: e.before,
    after: e.after,
    meta: e.meta,
    createdAt: e.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function toCommentDTO(c: typeof comments.$inferSelect): CommentDTO {
  return { id: c.id, issueId: c.issueId, authorId: c.authorId, body: c.body, createdAt: c.createdAt.toISOString() };
}

export async function listComments(ctx: Ctx, issueId: string): Promise<CommentDTO[]> {
  const issue = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, issue.workspaceId, "viewer");
  const rows = await ctx.db.select().from(comments).where(eq(comments.issueId, issueId)).orderBy(asc(comments.createdAt));
  return rows.map(toCommentDTO);
}

export async function createComment(ctx: Ctx, issueId: string, input: unknown): Promise<CommentDTO> {
  const { body } = CreateCommentInput.parse(input);
  const issue = await getIssueRow(ctx.db, issueId);
  await requireRole(ctx, issue.workspaceId, "member");
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(comments)
      .values({ issueId, workspaceId: issue.workspaceId, authorId: ctx.userId, body })
      .returning();
    await appendEvent(tx, {
      workspaceId: issue.workspaceId,
      actorId: ctx.userId,
      type: "comment.created",
      issueId,
      after: { commentId: row.id, excerpt: body.slice(0, 140) },
    });
    return toCommentDTO(row);
  });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function createLabel(ctx: Ctx, slug: string, input: unknown) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const data = CreateLabelInput.parse(input);
  const [row] = await ctx.db
    .insert(labels)
    .values({ workspaceId: workspace.id, name: data.name, color: data.color })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new Conflict(`A label named "${data.name}" already exists`);
  return { id: row.id, name: row.name, color: row.color };
}

export async function deleteLabel(ctx: Ctx, slug: string, labelId: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  await ctx.db.delete(labels).where(and(eq(labels.id, labelId), eq(labels.workspaceId, workspace.id)));
}
