import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString, max: 5 });
}

// Reuse one pool across hot reloads in dev (and across invocations of a warm serverless instance).
const globalForDb = globalThis as unknown as { __stridePool?: Pool };
export const pool = globalForDb.__stridePool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__stridePool = pool;

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run a query: the root db or an open transaction. */
export type Executor = DB | Tx;
