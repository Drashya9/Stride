import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { LinkRepoInput } from "@/lib/schemas";
import { requireWorkspace } from "../authz";
import type { Ctx } from "../ctx";
import type { DB } from "../db/client";
import { githubLinks, githubRepos, issues, metrics, webhookDeliveries, workspaces } from "../db/schema";
import { Conflict } from "../errors";
import { parseClosingRefs, verifyGitHubSignature } from "../integrations/github";
import { applyMove } from "./issues";

export async function listRepos(ctx: Ctx, slug: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const rows = await ctx.db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.workspaceId, workspace.id))
    .orderBy(asc(githubRepos.createdAt));
  return rows.map((r) => ({ id: r.id, repoFullName: r.repoFullName, webhookSecret: r.webhookSecret }));
}

export async function linkRepo(ctx: Ctx, slug: string, input: unknown) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  const { repoFullName } = LinkRepoInput.parse(input);
  const [row] = await ctx.db
    .insert(githubRepos)
    .values({
      workspaceId: workspace.id,
      repoFullName,
      webhookSecret: randomBytes(20).toString("hex"),
      createdBy: ctx.userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new Conflict(`${repoFullName} is already linked to a workspace`);
  return { id: row.id, repoFullName: row.repoFullName, webhookSecret: row.webhookSecret };
}

export async function unlinkRepo(ctx: Ctx, slug: string, id: string) {
  const { workspace } = await requireWorkspace(ctx, slug, "admin");
  await ctx.db.delete(githubRepos).where(and(eq(githubRepos.id, id), eq(githubRepos.workspaceId, workspace.id)));
}

// ---------------------------------------------------------------------------
// Webhook processing (v1: synchronous, inside the request, no de-duplication)
// ---------------------------------------------------------------------------

type WebhookResult = { status: number; body: Record<string, unknown> };

type PullRequestPayload = {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    merged?: boolean;
    merged_at?: string | null;
    user?: { login?: string };
  };
};

export async function handleGitHubWebhook(
  db: DB,
  raw: string,
  headers: { event: string | null; delivery: string | null; signature: string | null },
): Promise<WebhookResult> {
  const event = headers.event ?? "unknown";
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({ deliveryId: headers.delivery, event, status: "received" })
    .returning({ id: webhookDeliveries.id });
  const finish = async (status: string, result: WebhookResult, detail?: string) => {
    await db
      .update(webhookDeliveries)
      .set({ status, detail: detail ?? null, processedAt: new Date() })
      .where(eq(webhookDeliveries.id, delivery.id));
    return result;
  };

  let payload: PullRequestPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return finish("rejected", { status: 400, body: { error: "invalid json" } }, "invalid json");
  }

  const repoName = payload.repository?.full_name?.toLowerCase();
  const [repo] = repoName ? await db.select().from(githubRepos).where(eq(githubRepos.repoFullName, repoName)) : [];
  if (!repo) return finish("rejected", { status: 404, body: { error: "repository not linked" } }, `unknown repo ${repoName}`);

  // Verify before acting on anything in the payload.
  if (!verifyGitHubSignature(raw, repo.webhookSecret, headers.signature)) {
    return finish("rejected", { status: 401, body: { error: "invalid signature" } }, "bad signature");
  }

  if (event === "ping") return finish("done", { status: 200, body: { ok: true } });
  const pr = payload.pull_request;
  if (event !== "pull_request" || payload.action !== "closed" || !pr?.merged) {
    return finish("ignored", { status: 200, body: { ignored: true } });
  }

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, repo.workspaceId));
  const refs = parseClosingRefs(`${pr.title}\n${pr.body ?? ""}`).filter((r) => r.key === workspace.key);
  const closed: string[] = [];

  for (const ref of refs) {
    await db.transaction(async (tx) => {
      const [issue] = await tx
        .select()
        .from(issues)
        .where(and(eq(issues.workspaceId, workspace.id), eq(issues.number, ref.number), isNull(issues.deletedAt)));
      if (!issue) return;
      await tx
        .insert(githubLinks)
        .values({
          issueId: issue.id,
          repoFullName: repo.repoFullName,
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.html_url,
          state: "merged",
        })
        .onConflictDoNothing();
      if (issue.status === "done" || issue.status === "canceled") return;
      await applyMove(tx, issue, { status: "done" }, null, {
        source: "github",
        repo: repo.repoFullName,
        prNumber: pr.number,
        prUrl: pr.html_url,
        prAuthor: pr.user?.login ?? null,
      });
      closed.push(ref.identifier);
    });
  }

  if (closed.length && pr.merged_at) {
    await db.insert(metrics).values({
      name: "webhook_close_latency",
      valueMs: Math.max(0, Date.now() - Date.parse(pr.merged_at)),
      source: "server",
      tags: { issues: String(closed.length) },
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    });
  }

  return finish("done", { status: 200, body: { closed } }, closed.join(",") || "no matching issues");
}
