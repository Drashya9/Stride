import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";

/**
 * Dev login: sign in with just an email. Meant for local work and Playwright
 * (two users on one machine). Hard-disabled on Vercel production deployments.
 */
export const devLoginEnabled = process.env.ALLOW_DEV_LOGIN === "true" && process.env.VERCEL_ENV !== "production";

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  // Google verifies email addresses, so it's safe to attach a Google login to an
  // existing user with the same email (e.g. someone who was invited by email first).
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: {}, name: {} },
      async authorize(raw) {
        const parsed = z
          .object({ email: z.email().toLowerCase(), name: z.string().trim().max(60).optional() })
          .safeParse(raw);
        if (!parsed.success) return null;
        const { email } = parsed.data;
        const name = parsed.data.name || email.split("@")[0].replace(/^\w/, (c) => c.toUpperCase());
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) return existing;
        const [created] = await db.insert(users).values({ email, name }).returning();
        return created;
      },
    }),
  );
}

export const oauthProviders = providers
  .map((p) => (typeof p === "function" ? p() : p))
  .filter((p) => p.type === "oauth" || p.type === "oidc")
  .map((p) => ({ id: p.id, name: p.name }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT sessions: required for the credentials provider and cheap to verify.
  // Roles are NOT stored in the token — they're read from the DB on every request.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
