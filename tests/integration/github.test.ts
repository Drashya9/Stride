import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { signGitHubPayload } from "@/server/integrations/github";
import { getBoard } from "@/server/services/board";
import { handleGitHubWebhook, linkRepo } from "@/server/services/github";
import { createIssue, getIssue } from "@/server/services/issues";
import { setupWorkspace } from "./helpers";

type Setup = Awaited<ReturnType<typeof setupWorkspace>>;
let t: Setup;
let repo: { repoFullName: string; webhookSecret: string };

beforeAll(async () => {
  t = await setupWorkspace();
  repo = await linkRepo(t.alice, t.ws.slug, { repoFullName: `acme/app-${randomUUID().slice(0, 6)}` });
});

function mergedPr(title: string, prNumber = 7) {
  return JSON.stringify({
    action: "closed",
    repository: { full_name: repo.repoFullName },
    pull_request: {
      number: prNumber,
      title,
      body: null,
      html_url: `https://github.com/${repo.repoFullName}/pull/${prNumber}`,
      merged: true,
      merged_at: new Date().toISOString(),
      user: { login: "octocat" },
    },
  });
}

const send = (raw: string, signature: string | null, event = "pull_request") =>
  handleGitHubWebhook(db, raw, { event, delivery: randomUUID(), signature });

describe("GitHub webhook", () => {
  it("closes issues referenced by a merged PR and links the PR", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Webhook target", status: "in_progress" });
    const raw = mergedPr(`Fixes ${issue.identifier}`);
    const res = await send(raw, signGitHubPayload(raw, repo.webhookSecret));

    expect(res.status).toBe(200);
    expect(res.body.closed).toEqual([issue.identifier]);
    const detail = await getIssue(t.bob, issue.id);
    expect(detail.issue.status).toBe("done");
    expect(detail.issue.updatedById).toBeNull();
    expect(detail.githubLinks).toHaveLength(1);
  });

  it("rejects bad signatures without touching data", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Should stay open" });
    const raw = mergedPr(`Fixes ${issue.identifier}`);
    const res = await send(raw, signGitHubPayload(raw, "wrong-secret"));
    expect(res.status).toBe(401);
    const board = await getBoard(t.bob, t.ws.slug);
    expect(board.issues.find((i) => i.id === issue.id)?.status).toBe("todo");
  });

  it("ignores unmerged PRs, other workspaces' keys, and unknown repos", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Not yet" });
    const unmerged = mergedPr(`Fixes ${issue.identifier}`).replace('"merged":true', '"merged":false');
    expect((await send(unmerged, signGitHubPayload(unmerged, repo.webhookSecret))).body).toEqual({ ignored: true });

    const otherKey = mergedPr("Fixes ZZZZ-1");
    expect((await send(otherKey, signGitHubPayload(otherKey, repo.webhookSecret))).body.closed).toEqual([]);

    const unknown = mergedPr("Fixes X-1").replace(repo.repoFullName, "nobody/nothing");
    expect((await send(unknown, "sha256=00")).status).toBe(404);
  });

  it("replaying the same merged PR does not move the issue again (v1 behaviour)", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Replay" });
    const raw = mergedPr(`Closes ${issue.identifier}`, 99);
    const sig = signGitHubPayload(raw, repo.webhookSecret);
    await send(raw, sig);
    const second = await send(raw, sig);
    expect(second.body.closed).toEqual([]);
    const detail = await getIssue(t.bob, issue.id);
    expect(detail.githubLinks).toHaveLength(1);
  });
});
