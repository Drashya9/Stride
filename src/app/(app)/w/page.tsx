import { ArrowRight, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { Logo, RoleBadge, WorkspaceTile } from "@/components/ui/misc";
import { getCtx, getOptionalUser } from "@/server/ctx";
import { listWorkspaces } from "@/server/services/workspaces";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata = { title: "Workspaces" };

export default async function WorkspacesPage() {
  const [workspaces, user] = await Promise.all([getCtx().then(listWorkspaces), getOptionalUser()]);

  return (
    <main className="min-h-full bg-gradient-to-b from-indigo-500/8 via-bg to-bg">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold tracking-tight">Stride</span>
          </div>
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="text-[12px] text-muted">{user?.email}</span>
            <button type="submit" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-hover hover:text-fg">
              <LogOut size={13} /> Sign out
            </button>
          </form>
        </div>

        <h1 className="mt-10 text-2xl font-bold">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</h1>
        <p className="mt-1 text-[14px] text-muted">Pick a workspace, or create one for your team.</p>

        {workspaces.length ? (
          <ul className="mt-6 space-y-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/w/${w.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3 shadow-sm transition hover:border-indigo-500/40 hover:shadow-md"
                >
                  <WorkspaceTile keyText={w.key} size={36} />
                  <div className="flex-1">
                    <div className="font-semibold">{w.name}</div>
                    <div className="font-mono text-[11px] text-muted">{w.key}-123</div>
                  </div>
                  <RoleBadge role={w.role as "admin" | "member" | "viewer"} />
                  <ArrowRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-6 text-center text-[14px] text-muted">
            You’re not in any workspaces yet. Create one below, or open an invite link from a teammate.
          </div>
        )}

        <div className="mt-10">
          <h2 className="mb-3 inline-flex items-center gap-2 text-[15px] font-semibold">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <Plus size={14} />
            </span>
            Create a workspace
          </h2>
          <CreateWorkspaceForm />
        </div>
      </div>
    </main>
  );
}
