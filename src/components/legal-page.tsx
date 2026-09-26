import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export const LEGAL_UPDATED = "September 26, 2026";

/** Contact shown on legal pages. Set CONTACT_EMAIL in the environment; falls back to the GitHub repo. */
export function contactLine() {
  const email = process.env.CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`} className="text-accent hover:underline">
      {email}
    </a>
  ) : (
    "the project’s GitHub repository"
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-full bg-gradient-to-b from-indigo-500/8 via-bg to-bg">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2">
          <Logo size={26} />
          <span className="font-bold tracking-tight">Stride</span>
        </Link>
        <h1 className="mt-10 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-8 space-y-6 text-[14px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-fg/90 [&_ul]:space-y-1">
          {children}
        </div>
        <div className="mt-12 flex gap-4 border-t border-border pt-6 text-[13px] text-muted">
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fg">
            Terms
          </Link>
          <Link href="/" className="hover:text-fg">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export function LegalFooter() {
  return (
    <div className="flex justify-center gap-4 py-6 text-[12px] text-muted">
      <Link href="/privacy" className="hover:text-fg">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-fg">
        Terms
      </Link>
    </div>
  );
}
