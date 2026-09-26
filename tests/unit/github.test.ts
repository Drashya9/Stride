import { describe, expect, it } from "vitest";
import { parseClosingRefs, signGitHubPayload, verifyGitHubSignature } from "@/server/integrations/github";

describe("parseClosingRefs", () => {
  it("finds closing keywords in any case", () => {
    const refs = parseClosingRefs("Fixes CAP-42 and closes cap-7\nResolved: CAP-3");
    expect(refs.map((r) => r.identifier)).toEqual(["CAP-42", "CAP-7", "CAP-3"]);
  });

  it("supports every GitHub keyword form", () => {
    const text = ["close A-1", "closes A-2", "closed A-3", "fix A-4", "fixes A-5", "fixed A-6", "resolve A-7", "resolves A-8", "resolved A-9"];
    // "A" is too short for a key (2+ chars), so use AB
    const refs = parseClosingRefs(text.join(" ").replaceAll("A-", "AB-"));
    expect(refs).toHaveLength(9);
  });

  it("ignores plain mentions and de-duplicates", () => {
    expect(parseClosingRefs("Related to CAP-1, see CAP-2")).toEqual([]);
    expect(parseClosingRefs("Fixes CAP-1. Also fixes CAP-1")).toHaveLength(1);
  });

  it("does not match inside other words", () => {
    expect(parseClosingRefs("prefixes CAP-1")).toEqual([]);
  });
});

describe("GitHub signatures", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a correct signature", () => {
    expect(verifyGitHubSignature(body, "s3cret", signGitHubPayload(body, "s3cret"))).toBe(true);
  });

  it("rejects wrong secret, tampered body and missing header", () => {
    const sig = signGitHubPayload(body, "s3cret");
    expect(verifyGitHubSignature(body, "other", sig)).toBe(false);
    expect(verifyGitHubSignature(body + " ", "s3cret", sig)).toBe(false);
    expect(verifyGitHubSignature(body, "s3cret", null)).toBe(false);
    expect(verifyGitHubSignature(body, "s3cret", "sha1=abc")).toBe(false);
  });
});
