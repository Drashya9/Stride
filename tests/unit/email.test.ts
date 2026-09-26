import { afterEach, describe, expect, it, vi } from "vitest";
import { emailProvider, renderInviteEmail, sendInviteEmail } from "@/server/integrations/email";

describe("invite email", () => {
  it("contains the accept link and escapes user-provided names", () => {
    const { subject, text, html } = renderInviteEmail({
      link: "http://localhost:3000/invite/abc123",
      workspaceName: "<script>Team</script>",
      inviterName: "Alice & Bob",
      role: "member",
    });
    expect(subject).toContain("Alice & Bob invited you");
    expect(text).toContain("http://localhost:3000/invite/abc123");
    expect(html).toContain('href="http://localhost:3000/invite/abc123"');
    expect(html).toContain("&lt;script&gt;Team&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("email provider selection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers Gmail, then Resend, then none", () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailProvider()).toBe("none");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(emailProvider()).toBe("resend");
    vi.stubEnv("GMAIL_USER", "me@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    expect(emailProvider()).toBe("gmail");
  });

  it("reports not-sent (and doesn't throw) when nothing is configured", async () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await sendInviteEmail({ to: "x@gmail.com", link: "http://l/invite/t", workspaceName: "W", inviterName: "A", role: "member" });
    expect(res).toEqual({ sent: false, provider: "none" });
    info.mockRestore();
  });
});
