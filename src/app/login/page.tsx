import { MailOpen, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { devLoginEnabled, oauthProviders } from "@/auth";
import { ProviderButtons } from "@/components/auth-buttons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Logo } from "@/components/ui/misc";
import { getOptionalUser } from "@/server/ctx";
import { devSignIn } from "../actions";

export const metadata = { title: "Sign in" };

function safe(url: string) {
  return url.startsWith("/") && !url.startsWith("//") ? url : "/w";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; hint?: string }>;
}) {
  const { callbackUrl: rawCallback = "/w", error, hint } = await searchParams;
  const callbackUrl = safe(rawCallback);
  if (await getOptionalUser()) redirect(callbackUrl);
  const fromInvite = callbackUrl.startsWith("/invite/");

  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-500/10 via-bg to-sky-500/10 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo size={32} />
          <span className="text-xl font-bold tracking-tight">Stride</span>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-6 shadow-xl shadow-indigo-500/5">
          <h1 className="text-lg font-semibold">{fromInvite ? "Sign in to accept your invite" : "Welcome back"}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {fromInvite ? "You'll come right back to the invite after signing in." : "Sign in to see your team's boards."}
          </p>

          {fromInvite && hint && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-indigo-500/10 p-3 text-[13px] text-indigo-800 dark:text-indigo-200">
              <MailOpen size={16} className="mt-0.5 shrink-0" />
              <span>
                This invite is for <strong>{hint}</strong>. Sign in with that account.
              </span>
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-[13px] text-red-700 dark:text-red-300">
              <TriangleAlert size={16} /> Sign-in failed. Please try again.
            </div>
          )}

          <div className="mt-5">
            <ProviderButtons providers={oauthProviders} callbackUrl={callbackUrl} hint={hint} />
          </div>

          {!oauthProviders.length && !devLoginEnabled && (
            <p className="mt-4 text-[13px] text-muted">
              No sign-in methods are configured. Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (see README).
            </p>
          )}

          {devLoginEnabled && (
            <form action={devSignIn} className="mt-5 space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  DEV ONLY
                </span>
                <span className="text-[12px] text-muted">Sign in with any email, no password.</span>
              </div>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required defaultValue={hint ?? ""} placeholder="alice@stride.test" />
              </div>
              <div>
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" name="name" placeholder="Alice" />
              </div>
              <Button type="submit" variant="primary" className="h-9 w-full justify-center">
                Continue
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
