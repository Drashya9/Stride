import { count, gt, sql } from "drizzle-orm";
import { MetricsInput } from "@/lib/schemas";
import type { Ctx } from "../ctx";
import type { DB } from "../db/client";
import { events, issues, metrics, users, workspaces } from "../db/schema";

export async function recordMetrics(ctx: Ctx, input: unknown) {
  const { metrics: items } = MetricsInput.parse(input);
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  await ctx.db.insert(metrics).values(
    items.map((m) => ({
      name: m.name,
      valueMs: m.valueMs,
      tags: m.tags ?? null,
      source: "client",
      userId: ctx.userId,
      commitSha,
    })),
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function adminStats(db: DB) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[ws], [us], [is], [ev], activeRows, latency] = await Promise.all([
    db.select({ n: count() }).from(workspaces),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(issues),
    db.select({ n: count() }).from(events).where(gt(events.createdAt, weekAgo)),
    db
      .select({
        activeWorkspaces: sql<number>`count(distinct ${events.workspaceId})::int`,
        activeUsers: sql<number>`count(distinct ${events.actorId})::int`,
      })
      .from(events)
      .where(gt(events.createdAt, weekAgo)),
    db.execute<{ name: string; tag: string | null; n: number; p50: number; p95: number }>(sql`
      select name,
             coalesce(tags->>'action', tags->>'kind') as tag,
             count(*)::int as n,
             round(percentile_cont(0.5) within group (order by value_ms)::numeric, 1)::float as p50,
             round(percentile_cont(0.95) within group (order by value_ms)::numeric, 1)::float as p95
      from metrics
      group by 1, 2
      order by 1, 2`),
  ]);
  return {
    totals: { workspaces: ws.n, users: us.n, issues: is.n, eventsLast7d: ev.n },
    active: activeRows[0],
    latency: latency.rows,
  };
}
