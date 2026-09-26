/**
 * Sends a signed, GitHub-shaped "pull request merged" webhook to the local app,
 * so the GitHub integration can be tested without exposing localhost.
 *
 *   pnpm webhook:test                                  # "Fixes DEMO-3" to stride-demo/app
 *   pnpm webhook:test --title="Closes DEMO-7" --pr=18
 *   pnpm webhook:test --repeat=5                       # replay the same delivery (M5 baseline)
 *
 * Options: --url, --repo, --secret, --title, --body, --pr, --repeat
 */
import { randomUUID } from "node:crypto";
import { signGitHubPayload } from "../src/server/integrations/github";

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const url = arg("url", "http://localhost:3000") + "/api/webhooks/github";
const repo = arg("repo", "stride-demo/app");
const secret = arg("secret", "dev-webhook-secret");
const prNumber = Number(arg("pr", String(Math.floor(Math.random() * 900) + 100)));
const title = arg("title", "Fixes DEMO-3");
const body = arg("body", "");
const repeat = Number(arg("repeat", "1"));

const payload = JSON.stringify({
  action: "closed",
  number: prNumber,
  repository: { full_name: repo },
  pull_request: {
    number: prNumber,
    title,
    body,
    html_url: `https://github.com/${repo}/pull/${prNumber}`,
    merged: true,
    merged_at: new Date().toISOString(),
    user: { login: "octocat" },
  },
});
const delivery = randomUUID();

for (let i = 1; i <= repeat; i++) {
  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": delivery,
      "x-hub-signature-256": signGitHubPayload(payload, secret),
    },
    body: payload,
  });
  const text = await res.text();
  console.log(`#${i} ${res.status} in ${(performance.now() - t0).toFixed(0)}ms  ${text}`);
}
