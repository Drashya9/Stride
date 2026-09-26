"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

function safeRedirect(target: FormDataEntryValue | null) {
  const value = typeof target === "string" ? target : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/w";
}

export async function signInWithProvider(formData: FormData) {
  const provider = String(formData.get("provider"));
  const hint = String(formData.get("hint") ?? "").trim();
  await signIn(
    provider,
    { redirectTo: safeRedirect(formData.get("callbackUrl")) },
    // Pre-selects the invited Gmail account on Google's account chooser.
    provider === "google" && hint ? { login_hint: hint } : undefined,
  );
}

export async function devSignIn(formData: FormData) {
  const redirectTo = safeRedirect(formData.get("callbackUrl"));
  try {
    await signIn("dev", {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      redirectTo,
    });
  } catch (err) {
    // signIn throws a redirect on success — only swallow real auth failures.
    if (err instanceof AuthError) {
      redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }
    throw err;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** Signs out and returns to the login page, then back to `callbackUrl` (used by invites). */
export async function switchAccount(formData: FormData) {
  const callbackUrl = safeRedirect(formData.get("callbackUrl"));
  const hint = String(formData.get("hint") ?? "");
  const params = new URLSearchParams({ callbackUrl, ...(hint ? { hint } : {}) });
  await signOut({ redirectTo: `/login?${params}` });
}
