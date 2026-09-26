import { create } from "zustand";
import type { Status } from "@/lib/constants";

export type PalettePage = "root" | "status" | "priority" | "assignee";

type UIState = {
  /** Keyboard/hover focus on the board */
  focusedIssueId: string | null;
  setFocused: (id: string | null) => void;

  /** Issue detail panel */
  openIssueId: string | null;
  openIssue: (id: string | null) => void;

  createOpen: boolean;
  createDefaults: { status?: Status };
  openCreate: (defaults?: { status?: Status }) => void;
  closeCreate: () => void;

  paletteOpen: boolean;
  palettePage: PalettePage;
  openPalette: (page?: PalettePage) => void;
  setPalettePage: (page: PalettePage) => void;
  closePalette: () => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  /** Event ids of *my* recent undoable changes, newest last. */
  undoStack: number[];
  pushUndo: (eventId: number) => void;
  popUndo: () => number | undefined;
};

export const useUI = create<UIState>((set, get) => ({
  focusedIssueId: null,
  setFocused: (id) => set({ focusedIssueId: id }),

  openIssueId: null,
  openIssue: (id) => set({ openIssueId: id, ...(id ? { focusedIssueId: id } : {}) }),

  createOpen: false,
  createDefaults: {},
  openCreate: (defaults = {}) => set({ createOpen: true, createDefaults: defaults }),
  closeCreate: () => set({ createOpen: false }),

  paletteOpen: false,
  palettePage: "root",
  openPalette: (page = "root") => set({ paletteOpen: true, palettePage: page }),
  setPalettePage: (page) => set({ palettePage: page }),
  closePalette: () => set({ paletteOpen: false, palettePage: "root" }),

  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  undoStack: [],
  pushUndo: (eventId) => set((s) => ({ undoStack: [...s.undoStack.slice(-49), eventId] })),
  popUndo: () => {
    const stack = get().undoStack;
    const last = stack[stack.length - 1];
    if (last !== undefined) set({ undoStack: stack.slice(0, -1) });
    return last;
  },
}));

/** True while any overlay is open — board shortcuts are suspended then. */
export function overlayOpen(s: UIState) {
  return Boolean(s.openIssueId || s.createOpen || s.paletteOpen || s.shortcutsOpen);
}
