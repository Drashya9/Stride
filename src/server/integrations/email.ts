import nodemailer from "nodemailer";
import { Resend } from "resend";

/**
 * Invite emails. Transport is picked from env, in this order:
 *   1. Gmail SMTP  — GMAIL_USER + GMAIL_APP_PASSWORD (free, no domain needed, ~500/day)
 *   2. Resend      — RESEND_API_KEY (needs a verified domain to email other people)
 *   3. none        — the UI shows a copyable link; the link is also logged to the server console
 */

export type EmailProvider = "gmail" | "resend" | "none";

export function emailProvider(): EmailProvider {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  if (process.env.RESEND_API_KEY) return "resend";
  return "none";
}

/** Safe-to-display description of the email setup (never includes secrets). */
export function emailStatus() {
  const provider = emailProvider();
  return {
    provider,
    from: provider === "gmail" ? process.env.GMAIL_USER! : provider === "resend" ? (process.env.EMAIL_FROM ?? null) : null,
  };
}

export type SendResult = { sent: true; provider: EmailProvider } | { sent: false; provider: EmailProvider; error?: string };

type InviteEmail = { to: string; link: string; workspaceName: string; inviterName: string; role: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderInviteEmail({ link, workspaceName, inviterName, role }: Omit<InviteEmail, "to">) {
  const subject = `${inviterName} invited you to ${workspaceName} on Stride`;
  const text = [
    `${inviterName} invited you to join "${workspaceName}" on Stride as a ${role}.`,
    "",
    `Accept the invite: ${link}`,
    "",
    "The link expires in 7 days and can be used once.",
  ].join("\n");

  const ws = escapeHtml(workspaceName);
  const who = escapeHtml(inviterName);
  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e6e9">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:22px 28px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px">Stride</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 6px;font-size:20px;font-weight:600">You're invited to ${ws}</p>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#52525b">
            <strong style="color:#18181b">${who}</strong> invited you to join the <strong style="color:#18181b">${ws}</strong> workspace as a <strong style="color:#18181b">${escapeHtml(role)}</strong>.
          </p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px">Accept invite</a>
          <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#71717a">
            Or paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#6366f1;word-break:break-all">${escapeHtml(link)}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa">The link expires in 7 days and can be used once.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

let gmailTransport: nodemailer.Transporter | null = null;
function gmail() {
  gmailTransport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
  });
  return gmailTransport;
}

export async function sendInviteEmail(invite: InviteEmail): Promise<SendResult> {
  const provider = emailProvider();
  const { subject, text, html } = renderInviteEmail(invite);

  if (provider === "none") {
    console.info(`[email] no email provider configured — invite for ${invite.to}: ${invite.link}`);
    return { sent: false, provider };
  }

  try {
    if (provider === "gmail") {
      const from = `Stride <${process.env.GMAIL_USER}>`;
      await gmail().sendMail({ from, to: invite.to, subject, text, html });
    } else {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.EMAIL_FROM ?? "Stride <onboarding@resend.dev>",
        to: invite.to,
        subject,
        text,
        html,
      });
      if (error) throw new Error(error.message);
    }
    return { sent: true, provider };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${provider} send failed`, message);
    // Common Gmail failure: a normal password instead of an App Password.
    const hint = /Username and Password not accepted|535/.test(message)
      ? "Gmail rejected the login. Use a 16-character App Password, not your normal password."
      : message;
    return { sent: false, provider, error: hint };
  }
}
