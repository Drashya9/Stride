"use client";

import { Command } from "cmdk";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCommands, useTargetIssue, type Command as Cmd } from "@/client/commands";
import { useBoard, useMoveIssue, useSearch, useUpdateIssue } from "@/client/queries";
import { useUI } from "@/client/stores";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { Avatar, Keys } from "@/components/ui/misc";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, STATUSES } from "@/lib/constants";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const itemClass = "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-[13px] text-fg";

export function CommandPalette({ slug }: { slug: string }) {
  const open = useUI((s) => s.paletteOpen);
  const page = useUI((s) => s.palettePage);
  const close = useUI((s) => s.closePalette);
  const setPage = useUI((s) => s.setPalettePage);
  const openIssue = useUI((s) => s.openIssue);

  const commands = useCommands(slug);
  const target = useTargetIssue(slug);
  const { data: board } = useBoard(slug);
  const move = useMoveIssue(slug);
  const update = useUpdateIssue(slug);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 150);
  const search = useSearch(slug, page === "root" ? debounced : "");

  const reset = () => setQuery("");
  const onOpenChange = (o: boolean) => {
    if (!o) {
      close();
      reset();
    }
  };
  const run = (c: Cmd) => {
    if (!c.keepPaletteOpen) close();
    reset();
    c.run();
  };

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const visibleCommands = commands.filter((c) => c.enabled && c.id !== "palette" && c.id !== "search" && matches(c.title));
  const groups = ["Issue", "Navigation", "Workspace", "Help"] as const;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-black/40"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-bg shadow-2xl"
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !query && page !== "root") {
          e.preventDefault();
          setPage("root");
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        {page !== "root" ? (
          <button type="button" aria-label="Back" onClick={() => setPage("root")} className="text-muted hover:text-fg">
            <ChevronLeft size={16} />
          </button>
        ) : (
          <Search size={16} className="text-muted" />
        )}
        {target && page !== "root" && (
          <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[11px] text-muted">{target.identifier}</span>
        )}
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={
            page === "status" ? "Change status…" : page === "priority" ? "Set priority…" : page === "assignee" ? "Assign to…" : "Search issues or type a command…"
          }
          className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
        />
      </div>

      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">
          {search.isFetching ? "Searching…" : "No results"}
        </Command.Empty>

        {page === "root" && (
          <>
            {search.data?.length ? (
              <Command.Group heading="Issues">
                {search.data.map((r) => (
                  <Command.Item
                    key={r.issueId}
                    value={`issue-${r.issueId}`}
                    onSelect={() => {
                      close();
                      reset();
                      openIssue(r.issueId);
                    }}
                    className={itemClass}
                  >
                    <StatusIcon status={r.status} />
                    <span className="font-mono text-[12px] text-muted">{r.identifier}</span>
                    <span className="truncate">{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {groups.map((g) => {
              const items = visibleCommands.filter((c) => c.group === g);
              if (!items.length) return null;
              return (
                <Command.Group key={g} heading={g === "Issue" && target ? `Issue · ${target.identifier}` : g}>
                  {items.map((c) => (
                    <Command.Item key={c.id} value={c.id} onSelect={() => run(c)} className={itemClass}>
                      <span className="flex-1">{c.title}</span>
                      {c.keys && <Keys combo={c.keys} />}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </>
        )}

        {page === "status" &&
          target &&
          STATUSES.filter((s) => matches(STATUS_LABEL[s])).map((s) => (
            <Command.Item
              key={s}
              value={s}
              onSelect={() => {
                close();
                reset();
                if (s !== target.status) move.mutate({ issue: target, status: s });
              }}
              className={itemClass}
            >
              <StatusIcon status={s} />
              <span className="flex-1">{STATUS_LABEL[s]}</span>
              {s === target.status && <span className="text-[12px] text-muted">Current</span>}
            </Command.Item>
          ))}

        {page === "priority" &&
          target &&
          PRIORITIES.filter((p) => matches(PRIORITY_LABEL[p])).map((p) => (
            <Command.Item
              key={p}
              value={p}
              onSelect={() => {
                close();
                reset();
                if (p !== target.priority) update.mutate({ issue: target, patch: { priority: p } });
              }}
              className={itemClass}
            >
              <PriorityIcon priority={p} />
              <span className="flex-1">{PRIORITY_LABEL[p]}</span>
              {p === target.priority && <span className="text-[12px] text-muted">Current</span>}
            </Command.Item>
          ))}

        {page === "assignee" && target && board && (
          <>
            {matches("unassigned") && (
              <Command.Item
                value="unassigned"
                onSelect={() => {
                  close();
                  reset();
                  if (target.assigneeId) update.mutate({ issue: target, patch: { assigneeId: null } });
                }}
                className={itemClass}
              >
                <span className="flex-1 text-muted">Unassigned</span>
              </Command.Item>
            )}
            {board.members
              .filter((m) => matches(`${m.name ?? ""} ${m.email ?? ""}`))
              .map((m) => (
                <Command.Item
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    close();
                    reset();
                    if (m.id !== target.assigneeId) update.mutate({ issue: target, patch: { assigneeId: m.id } });
                  }}
                  className={itemClass}
                >
                  <Avatar name={m.name} email={m.email} image={m.image} size={18} />
                  <span className="flex-1">{m.name ?? m.email}</span>
                  {m.id === target.assigneeId && <span className="text-[12px] text-muted">Current</span>}
                </Command.Item>
              ))}
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
