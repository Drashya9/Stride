import { CalendarClock, CircleAlert, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { oauthProviders } from "@/auth";
import { switchAccount } from "@/app/actions";
import { ProviderButtons } from "@/components/auth-buttons";
import { Button } from "@/components/ui/button";
import { Logo, RoleBadge, WorkspaceTile } from "@/components/ui/misc";
import { ROLE_STYLE } from "@/lib/colors";
import { db } from "@/server/db/client";
import { getOptionalUser } from "@/server/ctx";
import { previewInvite } from "@/server/services/workspaces";
import { AcceptInvite } from "./accept-invite";

export const metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [user, invite] = await Promise.all([getOptionalUser(), previewInvite(db, token)]);
  const callbackUrl = `/invite/${token}`;
  const loginHref = `/login?${new URLSearchParams({ callbackUrl, ...(invite?.email ? { hint: invite.email } : {}) })}`;
  const wrongAccount = Boolean(user && invite?.email && user.email?.toLowerCase() !== invite.email);

  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-500/10 via-bg to-emerald-500/10 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo size={32} />
          <span className="text-xl font-bold tracking-tight">Stride</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-xl shadow-indigo-500/5">
          {!invite ? (
            <div className="p-6">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300">
                <CircleAlert size={18} />
                <h1 className="text-lg font-semibold">This invite can’t be used</h1>
              </div>
              <p className="mt-2 text-[13px] text-muted">It has expired, was revoked, or was already accepted. Ask your teammate for a new link.</p>
              <Link href="/w" className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline">
                Go to your workspaces →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white">
                <WorkspaceTile keyText={invite.workspaceKey} size={48} />
                <div>
                  <p className="text-[13px] opacity-90">{invite.inviterName} invited you to join</p>
                  <h1 className="text-xl font-bold">{invite.workspaceName}</h1>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRoundCheck size={15} className="text-muted" /> Role <RoleBadge role={invite.role} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarClock size={15} /> Expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <p className="text-[13px] text-muted">
                  As a {invite.role} you can {ROLE_STYLE[invite.role].hint}.
                </p>
                {invite.email && (
                  <p className="rounded-lg bg-subtle px-3 py-2 text-[13px]">
                    For <strong>{invite.email}</strong>
                  </p>
                )}

                {!user ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="text-[13px] font-medium">Sign in to accept</p>
                    {oauthProviders.length ? (
                      <ProviderButtons providers={oauthProviders} callbackUrl={callbackUrl} hint={invite.email} />
                    ) : null}
                    <Link href={loginHref} className="block text-center text-[13px] text-accent hover:underline">
                      {oauthProviders.length ? "Other sign-in options" : "Sign in to continue"}
                    </Link>
                  </div>
                ) : wrongAccount ? (
                  <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-900 dark:text-amber-200">
                    <p>
                      You’re signed in as <strong>{user.email}</strong>, but this invite is for <strong>{invite.email}</strong>.
                    </p>
                    <form action={switchAccount}>
                      <input type="hidden" name="callbackUrl" value={callbackUrl} />
                      <input type="hidden" name="hint" value={invite.email ?? ""} />
                      <Button type="submit" variant="primary">
                        Switch account
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="border-t border-border pt-4">
                    <p className="mb-3 text-[13px] text-muted">
                      Signed in as <span className="font-medium text-fg">{user.email}</span>
                    </p>
                    <AcceptInvite token={token} workspaceName={invite.workspaceName} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
