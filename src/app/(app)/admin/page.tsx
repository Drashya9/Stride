import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { adminStats, isAdminEmail } from "@/server/services/metrics";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();
  const stats = await adminStats(db);

  const tiles = [
    ["Workspaces", stats.totals.workspaces],
    ["Users", stats.totals.users],
    ["Issues", stats.totals.issues],
    ["Events (7d)", stats.totals.eventsLast7d],
    ["Active workspaces (7d)", stats.active?.activeWorkspaces ?? 0],
    ["Active users (7d)", stats.active?.activeUsers ?? 0],
  ] as const;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-lg font-semibold">Admin · adoption & latency</h1>
      <p className="mt-1 text-[13px] text-muted">
        Source of truth for BENCHMARKS.md. Latency is recorded by clients (sampled) and the server (webhooks).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border p-4">
            <div className="text-[12px] text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-[14px] font-medium">Latency (all time, ms)</h2>
      <table className="w-full text-[13px]">
        <thead className="text-left text-muted">
          <tr className="border-b border-border">
            <th className="py-2 font-medium">Metric</th>
            <th className="py-2 font-medium">Tag</th>
            <th className="py-2 text-right font-medium">Samples</th>
            <th className="py-2 text-right font-medium">p50</th>
            <th className="py-2 text-right font-medium">p95</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {stats.latency.map((r) => (
            <tr key={`${r.name}-${r.tag}`} className="border-b border-border">
              <td className="py-2 font-mono">{r.name}</td>
              <td className="py-2 text-muted">{r.tag ?? "—"}</td>
              <td className="py-2 text-right">{r.n}</td>
              <td className="py-2 text-right">{r.p50}</td>
              <td className="py-2 text-right">{r.p95}</td>
            </tr>
          ))}
          {!stats.latency.length && (
            <tr>
              <td colSpan={5} className="py-4 text-muted">
                No samples yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
