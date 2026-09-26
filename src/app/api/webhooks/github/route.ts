import { db } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { handleGitHubWebhook } from "@/server/services/github";

export async function POST(req: Request) {
  try {
    // The signature is computed over the exact bytes GitHub sent, so read the raw body first.
    const raw = await req.text();
    const result = await handleGitHubWebhook(db, raw, {
      event: req.headers.get("x-github-event"),
      delivery: req.headers.get("x-github-delivery"),
      signature: req.headers.get("x-hub-signature-256"),
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return errorResponse(err);
  }
}
