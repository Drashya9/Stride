import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { columnsOf } from "@/lib/board";
import type { Ctx } from "@/server/ctx";
import { db } from "@/server/db/client";
import { issues, memberships, users, workspaces } from "@/server/db/schema";
import { Forbidden, NotFound } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import { cleanupExpiredDemos, createDemo, DEMO_TTL_MS, DemoUnavailable, demoWorkspaceFor } from "@/server/services/demo";
import { linkRepo } from "@/server/services/github";
import { createIssue, moveIssue } from "@/server/services/issues";
import { acceptInvite, createInvite, createWorkspace } from "@/server/services/workspaces";
import { setupWorkspace } from "./helpers";

const guestCtx = (demo: Awaited<ReturnType<typeof createDemo>>): Ctx => ({ userId: demo.user.id, db });

describe("demo workspaces", () => {
  it("gives each visitor a private, pre-filled board as a member", async () => {
    const a = await createDemo(db);
    const b = await createDemo(db);
    expect(a.workspace.slug).not.toBe(b.workspace.slug);

    const board = await getBoard(guestCtx(a), a.workspace.slug);
    expect(board.role).toBe("member");
    expect(board.demoExpiresAt).not.toBeNull();
    expect(board.members).toHaveLength(4);
    expect(board.issues.length).toBeGreaterThan(10);
    // Every column the demo uses is ordered and non-empty.
    const cols = columnsOf(board);
    expect(cols.todo[0].title).toMatch(/^Start here/);
    expect(cols.in_progress.length).toBeGreaterThan(0);
    expect(cols.done.length).toBeGreaterThan(0);

    // Visitors can't see each other's demos.
    await expect(getBoard(guestCtx(b), a.workspace.slug)).rejects.toBeInstanceOf(NotFound);
    expect(await demoWorkspaceFor(guestCtx(a))).toBe(a.workspace.slug);
  });

  it("guests can use the board, but not admin features", async () => {
    const demo = await createDemo(db);
    const guest = guestCtx(demo);
    const { issue } = await createIssue(guest, demo.workspace.slug, { title: "Trying it out" });
    const moved = await moveIssue(guest, issue.id, { status: "done", baseVersion: issue.version });
    expect(moved.issue.status).toBe("done");

    await expect(createInvite(guest, demo.workspace.slug, { role: "member" }, "http://x")).rejects.toBeInstanceOf(Forbidden);
    await expect(linkRepo(guest, demo.workspace.slug, { repoFullName: "facebook/react" })).rejects.toBeInstanceOf(Forbidden);
  });

  it("guests can't create workspaces or join real teams", async () => {
    const guest = guestCtx(await createDemo(db));
    await expect(createWorkspace(guest, { name: "Mine", key: "GUEST" })).rejects.toBeInstanceOf(Forbidden);

    const { ws, alice } = await setupWorkspace();
    const invite = await createInvite(alice, ws.slug, { role: "member" }, "http://x");
    await expect(acceptInvite(guest, { token: invite.link.split("/invite/")[1] })).rejects.toBeInstanceOf(Forbidden);
  });

  it("cleanup deletes expired demos and their users, and nothing else", async () => {
    const real = await setupWorkspace();
    const fresh = await createDemo(db);
    const old = await createDemo(db, { now: new Date(Date.now() - DEMO_TTL_MS - 60_000) });
    const [oldWs] = await db.select().from(workspaces).where(eq(workspaces.slug, old.workspace.slug));
    const oldMembers = await db.select({ id: memberships.userId }).from(memberships).where(eq(memberships.workspaceId, oldWs.id));

    const removed = await cleanupExpiredDemos(db);
    expect(removed.workspaces).toBeGreaterThanOrEqual(1);

    expect(await db.select().from(workspaces).where(eq(workspaces.id, oldWs.id))).toHaveLength(0);
    expect(await db.select().from(issues).where(eq(issues.workspaceId, oldWs.id))).toHaveLength(0);
    const ids = oldMembers.map((m) => m.id);
    expect(await db.select().from(users).where(inArray(users.id, ids))).toHaveLength(0);

    // Live demos and real workspaces are untouched.
    expect((await getBoard(guestCtx(fresh), fresh.workspace.slug)).issues.length).toBeGreaterThan(0);
    expect((await getBoard(real.alice, real.ws.slug)).role).toBe("admin");
  });

  it("refuses new demos once the cap is reached", async () => {
    await createDemo(db);
    await expect(createDemo(db, { maxActive: 1 })).rejects.toBeInstanceOf(DemoUnavailable);
  });
});
