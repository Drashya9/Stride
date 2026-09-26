import { and, eq } from "drizzle-orm";
import { hasRole, type Role } from "@/lib/constants";
import type { Ctx } from "./ctx";
import type { Executor } from "./db/client";
import { memberships, workspaces } from "./db/schema";
import { Forbidden, NotFound } from "./errors";

export type WorkspaceAccess = {
  workspace: typeof workspaces.$inferSelect;
  role: Role;
};

async function membershipFor(db: Executor, userId: string, workspaceId: string) {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  return row?.role ?? null;
}

/**
 * The single authorization gate. Non-members get 404 (not 403) so the API
 * never reveals which workspaces exist; members below `min` get 403.
 */
export async function requireRole(ctx: Ctx, workspaceId: string, min: Role, db: Executor = ctx.db): Promise<Role> {
  const role = await membershipFor(db, ctx.userId, workspaceId);
  if (!role) throw new NotFound();
  if (!hasRole(role, min)) throw new Forbidden();
  return role;
}

export async function requireWorkspace(ctx: Ctx, slug: string, min: Role): Promise<WorkspaceAccess> {
  const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.slug, slug));
  if (!workspace) throw new NotFound();
  const role = await requireRole(ctx, workspace.id, min);
  return { workspace, role };
}
