"use client";

import type { Command } from "@/client/commands";
import { useUI } from "@/client/stores";
import { Dialog } from "@/components/ui/dialog";
import { Keys } from "@/components/ui/misc";

export function ShortcutsDialog({ commands }: { commands: Command[] }) {
  const open = useUI((s) => s.shortcutsOpen);
  const setOpen = useUI((s) => s.setShortcutsOpen);
  const withKeys = commands.filter((c) => c.keys);
  const coverage = Math.round((withKeys.length / commands.length) * 100);
  const groups = ["Issue", "Navigation", "Workspace", "Help"] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts">
      <div className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
          <span className="text-[12px] text-muted">{coverage}% of commands have a shortcut</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">{g}</h3>
              <ul className="space-y-1.5">
                {withKeys
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                      <span>{c.title.replace(/^Open .*/, "Open issue")}</span>
                      <Keys combo={c.keys!} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
