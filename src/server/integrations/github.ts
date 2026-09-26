import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies GitHub's `X-Hub-Signature-256` header against the raw request body. */
export function verifyGitHubSignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function signGitHubPayload(rawBody: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Finds closing references like "Fixes CAP-42", "closes: cap-7", "Resolved CAP-3".
 * Returns unique, upper-cased identifiers in order of appearance.
 */
export function parseClosingRefs(text: string): { key: string; number: number; identifier: string }[] {
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+([a-z][a-z0-9]{1,5})-(\d+)\b/gi;
  const seen = new Set<string>();
  const refs: { key: string; number: number; identifier: string }[] = [];
  for (const m of text.matchAll(re)) {
    const key = m[1].toUpperCase();
    const number = Number(m[2]);
    const identifier = `${key}-${number}`;
    if (!seen.has(identifier)) {
      seen.add(identifier);
      refs.push({ key, number, identifier });
    }
  }
  return refs;
}
