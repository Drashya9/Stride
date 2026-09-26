"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { columnsOf } from "@/lib/board";
import { hasRole, STATUSES } from "@/lib/constants";
import { useBoard, useDeleteIssue, useUndo, useUpdateIssue } from "./queries";
import { overlayOpen, useUI } from "./stores";

/**
 * Single command registry. The palette, the global hotkeys and the "?" help
 * sheet are all generated from this list, so they can't drift apart — and
 * keyboard coverage = commands with `keys` / all commands.
 */
export type Command = {
  id: string;
  title: string;
  group: "Issue" | "Navigation" | "Workspace" | "Help";
  /** "c", "mod+k", "g b" (sequence), "?" ... */
  keys?: string;
  enabled: boolean;
  /** Keep the palette open after running (used for sub-pages). */
  keepPaletteOpen?: boolean;
  run: () => void;
};

/** The issue commands act on: the open detail panel wins over board focus. */
export function useTargetIssue(slug: string) {
  const { data: board } = useBoard(slug);
  const openIssueId = useUI((s) => s.openIssueId);
  const focusedIssueId = useUI((s) => s.focusedIssueId);
  const id = openIssueId ?? focusedIssueId;
  return board?.issues.find((i) => i.id === id) ?? null;
}

export function useCommands(slug: string): Command[] {
  const router = useRouter();
  const { data: board } = useBoard(slug);
  const ui = useUI();
  const target = useTargetIssue(slug);
  const update = useUpdateIssue(slug);
  const del = useDeleteIssue(slug);
  const undo = useUndo(slug);

  const canEdit = board ? hasRole(board.role, "member") : false;
  const isAdmin = board ? hasRole(board.role, "admin") : false;
  const columns = useMemo(() => columnsOf(board), [board]);

  return useMemo(() => {
    const navigate = (dir: "up" | "down" | "left" | "right") => {
      const visible = STATUSES.filter((s) => columns[s].length);
      if (!visible.length) return;
      const current = board?.issues.find((i) => i.id === ui.focusedIssueId);
      if (!current) return ui.setFocused(columns[visible[0]][0].id);
      const col = columns[current.status];
      const idx = col.findIndex((i) => i.id === current.id);
      if (dir === "up" || dir === "down") {
        const next = col[Math.min(Math.max(idx + (dir === "down" ? 1 : -1), 0), col.length - 1)];
        return ui.setFocused(next.id);
      }
      const ci = visible.indexOf(current.status);
      const nextStatus = visible[ci + (dir === "right" ? 1 : -1)];
      if (!nextStatus) return;
      const nextCol = columns[nextStatus];
      ui.setFocused(nextCol[Math.min(idx, nextCol.length - 1)].id);
    };

    const commands: Command[] = [
      { id: "create", title: "Create issue", group: "Issue", keys: "c", enabled: canEdit, run: () => ui.openCreate() },
      {
        id: "open",
        title: target ? `Open ${target.identifier}` : "Open focused issue",
        group: "Issue",
        keys: "enter",
        enabled: Boolean(target),
        run: () => target && ui.openIssue(target.id),
      },
      {
        id: "status",
        title: "Change status…",
        group: "Issue",
        keys: "s",
        enabled: canEdit && Boolean(target),
        keepPaletteOpen: true,
        run: () => ui.openPalette("status"),
      },
      {
        id: "priority",
        title: "Set priority…",
        group: "Issue",
        keys: "p",
        enabled: canEdit && Boolean(target),
        keepPaletteOpen: true,
        run: () => ui.openPalette("priority"),
      },
      {
        id: "assign",
        title: "Assign to…",
        group: "Issue",
        keys: "a",
        enabled: canEdit && Boolean(target),
        keepPaletteOpen: true,
        run: () => ui.openPalette("assignee"),
      },
      {
        id: "assign-me",
        title: "Assign to me",
        group: "Issue",
        keys: "i",
        enabled: canEdit && Boolean(target) && target?.assigneeId !== board?.me.id,
        run: () => target && board && update.mutate({ issue: target, patch: { assigneeId: board.me.id } }),
      },
      {
        id: "delete",
        title: "Delete issue",
        group: "Issue",
        keys: "mod+backspace",
        enabled: isAdmin && Boolean(target),
        run: () => {
          if (target && window.confirm(`Delete ${target.identifier}? You can undo with Ctrl+Z.`)) {
            ui.openIssue(null);
            del.mutate(target);
          }
        },
      },
      { id: "undo", title: "Undo my last change", group: "Issue", keys: "mod+z", enabled: canEdit, run: () => undo.mutate() },

      { id: "down", title: "Next issue", group: "Navigation", keys: "j", enabled: true, run: () => navigate("down") },
      { id: "up", title: "Previous issue", group: "Navigation", keys: "k", enabled: true, run: () => navigate("up") },
      { id: "left", title: "Previous column", group: "Navigation", keys: "h", enabled: true, run: () => navigate("left") },
      { id: "right", title: "Next column", group: "Navigation", keys: "l", enabled: true, run: () => navigate("right") },
      { id: "search", title: "Search issues", group: "Navigation", keys: "/", enabled: true, run: () => ui.openPalette() },
      {
        id: "palette",
        title: "Command palette",
        group: "Navigation",
        keys: "mod+k",
        enabled: true,
        run: () => (ui.paletteOpen ? ui.closePalette() : ui.openPalette()),
      },

      { id: "go-board", title: "Go to board", group: "Workspace", keys: "g b", enabled: true, run: () => router.push(`/w/${slug}`) },
      {
        id: "go-activity",
        title: "Go to activity",
        group: "Workspace",
        keys: "g a",
        enabled: true,
        run: () => router.push(`/w/${slug}/activity`),
      },
      {
        id: "go-settings",
        title: "Go to settings",
        group: "Workspace",
        keys: "g s",
        enabled: true,
        run: () => router.push(`/w/${slug}/settings`),
      },
      { id: "go-workspaces", title: "Switch workspace", group: "Workspace", keys: "g w", enabled: true, run: () => router.push("/w") },

      { id: "shortcuts", title: "Keyboard shortcuts", group: "Help", keys: "?", enabled: true, run: () => ui.setShortcutsOpen(true) },
    ];
    return commands;
  }, [board, columns, canEdit, isAdmin, target, ui, update, del, undo, router, slug]);
}

// ---------------------------------------------------------------------------
// Global hotkeys
// ---------------------------------------------------------------------------

function comboFromEvent(e: KeyboardEvent): string | null {
  // Autofill / password managers dispatch keydown events with no `key` at all.
  if (typeof e.key !== "string" || !e.key) return null;
  const mod = e.ctrlKey || e.metaKey ? "mod+" : "";
  const alt = e.altKey ? "alt+" : "";
  const key = e.key.toLowerCase();
  // Shift is implied for printable symbols like "?"; keep it only for letters.
  const shift = e.shiftKey && /^[a-z]$/.test(key) ? "shift+" : "";
  return `${mod}${alt}${shift}${key}`;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Commands that still work while a dialog is open. */
const ALWAYS_ON = new Set(["mod+k"]);

export function useHotkeys(commands: Command[]) {
  const latest = useRef(commands);
  useEffect(() => {
    latest.current = commands;
  }, [commands]);

  useEffect(() => {
    let pending: { key: string; at: number } | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      if (isTyping(e.target) && !ALWAYS_ON.has(combo)) return;
      if (overlayOpen(useUI.getState()) && !ALWAYS_ON.has(combo)) return;

      const cmds = latest.current;
      let candidate = combo;
      if (pending && Date.now() - pending.at < 1000) candidate = `${pending.key} ${combo}`;
      pending = null;

      const match = cmds.find((c) => c.keys === candidate) ?? cmds.find((c) => c.keys === combo);
      if (match) {
        if (!match.enabled) return;
        e.preventDefault();
        match.run();
        return;
      }
      if (cmds.some((c) => c.keys?.startsWith(`${combo} `))) {
        pending = { key: combo, at: Date.now() };
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
