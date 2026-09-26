import { auth } from "@/auth";
import { db, type DB } from "./db/client";
import { Unauthorized } from "./errors";

/** Per-request context passed to every service function. Tests build their own. */
export type Ctx = { userId: string; db: DB };

export async function getCtx(): Promise<Ctx> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Unauthorized();
  return { userId, db };
}

export async function getOptionalUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
