"use client";

import { useMemo, useState } from "react";
import { useBoard, useEvents } from "@/client/queries";
import { useUI } from "@/client/stores";
import { actorName, describeEvent, EventIcon } from "@/components/activity";
import { Select } from "@/components/ui/input";
import { EVENT_STYLE } from "@/lib/colors";
import type { EventDTO } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

/** Stable key for "who did this": the actor's user id, or a bucket for non-member actors. */
function actorKey(e: EventDTO) {
  return e.actorId ?? (e.meta?.source === "github" ? "github" : "system");
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function ActivityFeed({ slug }: { slug: string }) {
  const { data: board } = useBoard(slug);
  const { data: events, isLoading } = useEvents(slug);
  const openIssue = useUI((s) => s.openIssue);
  const [actorFilter, setActorFilter] = useState("all");

  // Who's actually in the log, in order of most recent activity — not the full member
  // list, so the dropdown only offers people (or GitHub/System) with something to show.
  const actors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events ?? []) {
      const key = actorKey(e);
      if (!seen.has(key)) seen.set(key, actorName(e, board));
    }
    return [...seen.entries()];
  }, [events, board]);

  const filtered = actorFilter === "all" ? (events ?? []) : (events ?? []).filter((e) => actorKey(e) === actorFilter);

  const groups: { day: string; items: EventDTO[] }[] = [];
  for (const e of filtered) {
    const day = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-bold">Activity</h1>
        <p className="mb-6 text-[13px] text-muted">Everything that happened in {board?.workspace.name}, newest first.</p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-[12px]">
            {[
              ["issue.created", "Created"],
              ["issue.moved", "Moved"],
              ["issue.updated", "Edited"],
              ["comment.created", "Commented"],
              ["issue.deleted", "Deleted"],
            ].map(([type, label]) => (
              <span key={type} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", EVENT_STYLE[type])}>
                {label}
              </span>
            ))}
          </div>
          {actors.length > 0 && (
            <Select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-44 shrink-0"
              aria-label="Filter activity by person"
            >
              <option value="all">Everyone</option>
              {actors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {isLoading && <p className="text-[13px] text-muted">Loading…</p>}
        {events && !events.length && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
            Nothing has happened yet. Create an issue with <kbd className="rounded border border-border px-1">C</kbd>.
          </div>
        )}
        {events && events.length > 0 && !filtered.length && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
            No activity from {actors.find(([id]) => id === actorFilter)?.[1] ?? "that person"}.
          </div>
        )}

        {groups.map((g) => (
          <div key={g.day} className="mb-6">
            <h2 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">{g.day}</h2>
            <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
              {g.items.map((e) => {
                const live = e.issueId && board?.issues.some((i) => i.id === e.issueId);
                return (
                  <li key={e.id} className="relative flex items-start gap-3 rounded-lg py-1.5 pr-2 text-[13px] hover:bg-hover">
                    <EventIcon event={e} />
                    <div className="min-w-0 flex-1 pt-1">
                      <span className="font-semibold">{actorName(e, board)}</span> <span className="text-muted">{describeEvent(e, board)}</span>
                      {e.issueIdentifier && (
                        <>
                          {" "}
                          <button
                            type="button"
                            disabled={!live}
                            onClick={() => e.issueId && openIssue(e.issueId)}
                            className="rounded bg-hover px-1 font-mono text-[12px] text-fg hover:bg-indigo-500/15 hover:text-indigo-700 disabled:opacity-60 dark:hover:text-indigo-300"
                          >
                            {e.issueIdentifier}
                          </button>{" "}
                          <span className="text-muted">{e.issueTitle}</span>
                        </>
                      )}
                    </div>
                    <span className="shrink-0 pt-1 text-[12px] text-muted">{timeAgo(e.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
