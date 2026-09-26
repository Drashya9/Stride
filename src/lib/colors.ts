import type { Priority, Role, Status } from "./constants";

/**
 * One color language for the whole app. Class strings are written out in full
 * so Tailwind can see them.
 *
 *   Backlog = slate · Todo = sky · In Progress = amber · Done = emerald · Canceled = rose
 *   Urgent = red · High = orange · Medium = yellow · Low = sky · None = slate
 *   Admin = violet · Member = sky · Viewer = slate
 */

type Swatch = {
  /** solid bar / dot */
  solid: string;
  /** tinted background */
  soft: string;
  /** readable text on a soft background */
  text: string;
  /** subtle border */
  border: string;
  /** icon color */
  icon: string;
};

export const STATUS_STYLE: Record<Status, Swatch & { hint: string }> = {
  backlog: {
    solid: "bg-slate-400",
    soft: "bg-slate-500/8",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-400/30",
    icon: "text-slate-400",
    hint: "Ideas and work for later",
  },
  todo: {
    solid: "bg-sky-500",
    soft: "bg-sky-500/8",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30",
    icon: "text-sky-500",
    hint: "Ready to start",
  },
  in_progress: {
    solid: "bg-amber-500",
    soft: "bg-amber-500/8",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    icon: "text-amber-500",
    hint: "Someone is working on it",
  },
  done: {
    solid: "bg-emerald-500",
    soft: "bg-emerald-500/8",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    icon: "text-emerald-500",
    hint: "Finished",
  },
  canceled: {
    solid: "bg-rose-400",
    soft: "bg-rose-500/8",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-400/30",
    icon: "text-rose-400",
    hint: "Won't do",
  },
};

export const PRIORITY_STYLE: Record<Priority, Swatch & { stripe: string }> = {
  urgent: {
    solid: "bg-red-500",
    soft: "bg-red-500/12",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/30",
    icon: "text-red-500",
    stripe: "border-l-red-500",
  },
  high: {
    solid: "bg-orange-500",
    soft: "bg-orange-500/12",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    icon: "text-orange-500",
    stripe: "border-l-orange-500",
  },
  medium: {
    solid: "bg-yellow-500",
    soft: "bg-yellow-500/15",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-500/30",
    icon: "text-yellow-500",
    stripe: "border-l-yellow-400",
  },
  low: {
    solid: "bg-sky-400",
    soft: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-400/30",
    icon: "text-sky-500",
    stripe: "border-l-sky-400",
  },
  none: {
    solid: "bg-slate-300",
    soft: "bg-slate-500/8",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-400/20",
    icon: "text-slate-400",
    stripe: "border-l-transparent",
  },
};

export const ROLE_STYLE: Record<Role, { badge: string; hint: string }> = {
  admin: { badge: "bg-violet-500/12 text-violet-700 dark:text-violet-300", hint: "manage members, settings and GitHub" },
  member: { badge: "bg-sky-500/12 text-sky-700 dark:text-sky-300", hint: "create and edit issues" },
  viewer: { badge: "bg-slate-500/12 text-slate-700 dark:text-slate-300", hint: "view the board (read-only)" },
};

/** Activity feed: icon tint per event kind. */
export const EVENT_STYLE: Record<string, string> = {
  "issue.created": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  "issue.moved": "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  "issue.updated": "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  "issue.deleted": "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  "issue.undone": "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  "comment.created": "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  github: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
};
