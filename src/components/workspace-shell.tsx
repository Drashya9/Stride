"use client";

import { Activity, ChevronLeft, CircleHelp, Keyboard, LayoutGrid, LogOut, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { useCommands, useHotkeys } from "@/client/commands";
import { useBoard, useSyncLatency } from "@/client/queries";
import { useUI } from "@/client/stores";
import { CreateIssueDialog } from "@/components/issue/create-issue-dialog";
import { IssueDialog } from "@/components/issue/issue-dialog";
import { CommandPalette } from "@/components/palette/command-palette";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { setTipsDismissed, TipsBar, useTipsDismissed } from "@/components/tips-bar";
import { Button } from "@/components/ui/button";
import { Avatar, Keys, RoleBadge, WorkspaceTile } from "@/components/ui/misc";
import { hasRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function WorkspaceShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: board } = useBoard(slug);
  const commands = useCommands(slug);
  useHotkeys(commands);
  useSyncLatency(board);
  const openCreate = useUI((s) => s.openCreate);
  const openPalette = useUI((s) => s.openPalette);
  const setShortcutsOpen = useUI((s) => s.setShortcutsOpen);
  const tipsDismissed = useTipsDismissed();

  if (!board) return null;
  const me = board.members.find((m) => m.id === board.me.id);

  const nav = [
    { href: `/w/${slug}`, label: "Board", Icon: LayoutGrid, active: "text-indigo-600 dark:text-indigo-300" },
    { href: `/w/${slug}/activity`, label: "Activity", Icon: Activity, active: "text-emerald-600 dark:text-emerald-300" },
    { href: `/w/${slug}/settings`, label: "Settings", Icon: Settings, active: "text-amber-600 dark:text-amber-300" },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
        <Link href="/w" className="rounded p-0.5 text-muted hover:bg-hover hover:text-fg" aria-label="All workspaces">
          <ChevronLeft size={16} />
        </Link>
        <WorkspaceTile keyText={board.workspace.key} size={28} />
        <span className="font-semibold">{board.workspace.name}</span>
        <nav className="ml-2 flex gap-1">
          {nav.map(({ href, label, Icon, active }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-hover hover:text-fg",
                  isActive && cn("bg-hover", active),
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => openPalette()} className="hidden text-muted md:inline-flex" aria-label="Search">
            <Search size={14} />
            <span>Search</span>
            <Keys combo="mod+k" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <Keyboard size={15} />
          </Button>
          {tipsDismissed && (
            <Button size="icon" variant="ghost" onClick={() => setTipsDismissed(false)} aria-label="Show tips" title="Show quick-start tips">
              <CircleHelp size={15} />
            </Button>
          )}
          {hasRole(board.role, "member") && (
            <Button size="sm" variant="primary" onClick={() => openCreate()} className="shadow-sm">
              <Plus size={14} /> New issue
            </Button>
          )}
          <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
            <Avatar name={me?.name} email={me?.email} image={me?.image} size={24} />
            <div className="hidden leading-tight lg:block">
              <div className="text-[12px] font-medium">{me?.name ?? me?.email}</div>
              <RoleBadge role={board.role} />
            </div>
            <form action={signOutAction}>
              <button type="submit" className="rounded p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Sign out" title="Sign out">
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <TipsBar />

      <main className="min-h-0 flex-1">{children}</main>

      <IssueDialog slug={slug} />
      <CreateIssueDialog slug={slug} />
      <CommandPalette slug={slug} />
      <ShortcutsDialog commands={commands} />
    </div>
  );
}
