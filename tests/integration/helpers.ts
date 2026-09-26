import { randomUUID } from "node:crypto";
import type { Role } from "@/lib/constants";
import type { Ctx } from "@/server/ctx";
import { db } from "@/server/db/client";
import { memberships, users } from "@/server/db/schema";
import { createWorkspace } from "@/server/services/workspaces";

export async function makeUser(name: string): Promise<Ctx & { email: string }> {
  const email = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`;
  const [u] = await db.insert(users).values({ email, name }).returning();
  return { userId: u.id, db, email };
}

/** Random workspace key: "T" + 5 base-36 chars (~60M combinations). */
function uniqueKey() {
  const n = Number.parseInt(randomUUID().replace(/-/g, "").slice(0, 10), 16);
  return `T${n.toString(36).toUpperCase().slice(-5).padStart(5, "0")}`;
}

/** Workspace with alice (admin), bob (member), carol (viewer), and an outsider. */
export async function setupWorkspace() {
  const [alice, bob, carol, outsider] = await Promise.all([
    makeUser("Alice"),
    makeUser("Bob"),
    makeUser("Carol"),
    makeUser("Mallory"),
  ]);
  const ws = await createWorkspace(alice, { name: `Team ${randomUUID().slice(0, 6)}`, key: uniqueKey() });
  const add = (ctx: Ctx, role: Role) => db.insert(memberships).values({ workspaceId: ws.id, userId: ctx.userId, role });
  await add(bob, "member");
  await add(carol, "viewer");
  return { ws, alice, bob, carol, outsider };
}
