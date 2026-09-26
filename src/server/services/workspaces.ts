import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { LABEL_COLORS } from "@/lib/constants";
import { AcceptInviteInput, CreateInviteInput, CreateWorkspaceInput, UpdateMemberInput } from "@/lib/schemas";
import type { WorkspaceDTO } from "@/lib/types";
import { requireWorkspace } from "../authz";
import type { Ctx } from "../ctx";
import type { Executor } from "../db/client";
import { invites, labels, memberships, users, workspaces } from "../db/schema";
import { BadRequest, Conflict, Forbidden, NotFound } from "../errors";
import { sendInviteEmail } from "../integrations/email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LABELS = [
  { name: "Bug", color: LABEL_COLORS[0] },
  { name: "Feature", color: LABEL_COLORS[5] },
  { name: "Docs", color: LABEL_COLORS[3] },
];

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listWorkspaces(ctx: Ctx): Promise<(WorkspaceDTO & { role: string })[]> {
  return ctx.db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      key: workspaces.key,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, ctx.userId))
    .orderBy(asc(workspaces.name));
}

export async function createWorkspace(ctx: Ctx, input: unknown): Promise<WorkspaceDTO> {
  const data = CreateWorkspaceInput.parse(input);
  const [taken] = await ctx.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.key, data.key));
  if (taken) throw new Conflict(`The key "${data.key}" is already used by another workspace`);

  const base = slugify(data.name);
  return ctx.db.transaction(async (tx) => {
    let slug = base;
    for (let i = 0; ; i++) {
      const [exists] = await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug));
      if (!exists) break;
      slug = `${base}-${randomBytes(2).toString("hex")}`;
      if (i > 5) throw new Conflict("Could not pick a unique URL, try another name");
    }
    const [ws] = await tx.insert(workspaces).values({ name: data.name, key: data.key, slug }).returning();
    await tx.insert(memberships).values({ workspaceId: ws.id, userId: ctx.userId, role: "admin" });
    await tx.insert(labels).values(DEFAULT_LABELS.map((l) => ({ ...l, workspaceId: ws.id })));
    return { id: ws.id, slug: ws.slug, name: ws.name, key: ws.key };
  });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function adminCount(db: Executor, workspaceId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, "admin")));
  return row.n;
}

async function targetMembership(db: Executor, workspaceId: string, userId: string) {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  if (!m) throw new NotFound("Member not found");
  return m;
}

export async function updateMemberRole(ctx: Ctx, slug: string, userId: string, input: unknown) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const { role } = UpdateMemberInput.parse(input);
  const target = await targetMembership(ctx.db, workspace.id, userId);
  if (target.role === "admin" && role !== "admin" && (await adminCount(ctx.db, workspace.id)) <= 1) {
    throw new BadRequest("A workspace needs at least one admin");
  }
  await ctx.db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.workspaceId, workspace.id), eq(memberships.userId, userId)));
  return { userId, role };
}

/** Admins can remove anyone; anyone can remove themselves (leave). */
export async function removeMember(ctx: Ctx, slug: string, userId: string) {
  const isSelf = userId === ctx.userId;
  const { workspace } = await requireWorkspace(ctx, slug, isSelf ? "viewer" : "admin");
  const target = await targetMembership(ctx.db, workspace.id, userId);
  if (target.role === "admin" && (await adminCount(ctx.db, workspace.id)) <= 1) {
    throw new BadRequest("A workspace needs at least one admin");
  }
  await ctx.db.delete(memberships).where(and(eq(memberships.workspaceId, workspace.id), eq(memberships.userId, userId)));
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function createInvite(ctx: Ctx, slug: string, input: unknown, appUrl: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const data = CreateInviteInput.parse(input);
  const token = randomBytes(24).toString("base64url");
  const [invite] = await ctx.db
    .insert(invites)
    .values({
      workspaceId: workspace.id,
      email: data.email?.toLowerCase() ?? null,
      role: data.role,
      tokenHash: hashToken(token),
      invitedBy: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning();

  const link = `${appUrl.replace(/\/$/, "")}/invite/${token}`;
  let emailed = false;
  let emailError: string | null = null;
  if (invite.email) {
    const [inviter] = await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, ctx.userId));
    const result = await sendInviteEmail({
      to: invite.email,
      link,
      workspaceName: workspace.name,
      inviterName: inviter?.name ?? "A teammate",
      role: invite.role,
    });
    emailed = result.sent;
    if (!result.sent) emailError = result.error ?? (result.provider === "none" ? "Email isn't set up yet" : "Email failed");
  }
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    link,
    emailed,
    emailError,
  };
}

export async function listInvites(ctx: Ctx, slug: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const rows = await ctx.db
    .select()
    .from(invites)
    .where(and(eq(invites.workspaceId, workspace.id), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .orderBy(asc(invites.createdAt));
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, expiresAt: r.expiresAt.toISOString() }));
}

export async function revokeInvite(ctx: Ctx, slug: string, inviteId: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  await ctx.db.delete(invites).where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspace.id)));
}

/** Public preview for the invite page. Returns null for unknown/expired/used tokens. */
export async function previewInvite(db: Executor, token: string) {
  const [row] = await db
    .select({ invite: invites, workspace: workspaces, inviterName: users.name })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(eq(invites.tokenHash, hashToken(token)));
  if (!row || row.invite.acceptedAt || row.invite.expiresAt < new Date()) return null;
  return {
    workspaceName: row.workspace.name,
    workspaceSlug: row.workspace.slug,
    workspaceKey: row.workspace.key,
    role: row.invite.role,
    email: row.invite.email,
    inviterName: row.inviterName ?? "A teammate",
    expiresAt: row.invite.expiresAt.toISOString(),
  };
}

export async function acceptInvite(ctx: Ctx, input: unknown) {
  const { token } = AcceptInviteInput.parse(input);
  return ctx.db.transaction(async (tx) => {
    const [invite] = await tx.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).for("update");
    if (!invite || invite.expiresAt < new Date()) throw new NotFound("This invite link is invalid or has expired");
    if (invite.acceptedAt && invite.acceptedBy !== ctx.userId) throw new NotFound("This invite has already been used");

    if (invite.email) {
      const [me] = await tx.select({ email: users.email }).from(users).where(eq(users.id, ctx.userId));
      if (me?.email?.toLowerCase() !== invite.email) {
        throw new Forbidden(`This invite was sent to ${invite.email}. Sign in with that account to accept it.`);
      }
    }

    await tx
      .insert(memberships)
      .values({ workspaceId: invite.workspaceId, userId: ctx.userId, role: invite.role })
      .onConflictDoNothing();
    await tx.update(invites).set({ acceptedAt: new Date(), acceptedBy: ctx.userId }).where(eq(invites.id, invite.id));
    const [ws] = await tx.select({ slug: workspaces.slug }).from(workspaces).where(eq(workspaces.id, invite.workspaceId));
    return { slug: ws.slug };
  });
}
