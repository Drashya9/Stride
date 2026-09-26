import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-2 px-4">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-[13px] text-muted">This page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/w" className="mt-2 text-[13px] text-accent hover:underline">
        Back to your workspaces
      </Link>
    </main>
  );
}
