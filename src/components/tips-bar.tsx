"use client";

import { Lightbulb, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Keys } from "@/components/ui/misc";
import { PRIORITY_STYLE } from "@/lib/colors";
import { cn } from "@/lib/utils";

const KEY = "stride:tips-dismissed";
const EVENT = "stride:tips";

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function setTipsDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the bar just stays visible */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTipsDismissed() {
  // Server snapshot = dismissed, so the bar never flashes during hydration.
  return useSyncExternalStore(subscribe, read, () => true);
}

const tips: { keys: string; text: string; tone: string }[] = [
  { keys: "c", text: "new issue", tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { keys: "mod+k", text: "search & commands", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { keys: "s", text: "status of hovered card", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { keys: "mod+z", text: "undo", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { keys: "?", text: "all shortcuts", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
];

const legend = [
  { label: "Urgent", cls: PRIORITY_STYLE.urgent.solid },
  { label: "High", cls: PRIORITY_STYLE.high.solid },
  { label: "Medium", cls: PRIORITY_STYLE.medium.solid },
  { label: "Low", cls: PRIORITY_STYLE.low.solid },
];

export function TipsBar() {
  const dismissed = useTipsDismissed();
  if (dismissed) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-indigo-500/15 bg-gradient-to-r from-indigo-500/8 via-violet-500/6 to-sky-500/8 px-4 py-2 text-[12px]">
      <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
        <Lightbulb size={14} /> Quick start
      </span>
      <span className="text-muted">Drag cards between columns to change their status.</span>
      {tips.map((t) => (
        <span key={t.keys} className={cn("inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1", t.tone)}>
          <Keys combo={t.keys} />
          {t.text}
        </span>
      ))}
      <span className="inline-flex items-center gap-2 text-muted">
        Card edge = priority:
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className={cn("h-3 w-1 rounded-full", l.cls)} />
            {l.label}
          </span>
        ))}
      </span>
      <button
        type="button"
        onClick={() => setTipsDismissed(true)}
        className="ml-auto rounded p-1 text-muted hover:bg-hover hover:text-fg"
        aria-label="Hide tips"
      >
        <X size={14} />
      </button>
    </div>
  );
}
