"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useFormStatus } from "react-dom";
import { startDemo } from "@/app/actions";
import { cn } from "@/lib/utils";

function Submit({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/8 px-5 text-[14px] font-semibold text-indigo-700 hover:bg-indigo-500/15 disabled:opacity-70 dark:text-indigo-200",
        className,
      )}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
      {pending ? "Setting up your board…" : "Try the demo"}
    </button>
  );
}

/** One click: a private, pre-filled demo workspace, no account needed. */
export function DemoButton({ className }: { className?: string }) {
  return (
    <form action={startDemo}>
      <Submit className={className} />
    </form>
  );
}
