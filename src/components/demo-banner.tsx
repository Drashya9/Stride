import { Sparkles } from "lucide-react";
import { switchAccount } from "@/app/actions";

/** Shown in demo workspaces: what this is, and the way out to a real account. */
export function DemoBanner() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-indigo-500/20 bg-indigo-500/8 px-4 py-2 text-[13px] text-indigo-900 dark:text-indigo-100">
      <Sparkles size={14} className="shrink-0 text-indigo-500" />
      <span>
        <strong>Demo workspace.</strong> Only you can see it, and it’s deleted 24 hours after you opened it, so change
        anything.
      </span>
      <form action={switchAccount} className="ml-auto">
        <input type="hidden" name="callbackUrl" value="/w" />
        <button type="submit" className="font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">
          Sign in to make your own →
        </button>
      </form>
    </div>
  );
}
