import { Command, GitMerge, Keyboard, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/misc";
import { STATUS_STYLE } from "@/lib/colors";
import { STATUS_LABEL, type Status } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getOptionalUser } from "@/server/ctx";

const preview: { status: Status; cards: { title: string; stripe: string }[] }[] = [
  { status: "todo", cards: [{ title: "Write project proposal", stripe: "border-l-orange-500" }, { title: "Set up repo", stripe: "border-l-sky-400" }] },
  { status: "in_progress", cards: [{ title: "Design database schema", stripe: "border-l-red-500" }] },
  { status: "done", cards: [{ title: "Pick a team name", stripe: "border-l-transparent" }, { title: "Book meeting room", stripe: "border-l-yellow-400" }] },
];

export default async function Home() {
  if (await getOptionalUser()) redirect("/w");

  const features = [
    { Icon: Keyboard, title: "Keyboard-first", body: "C to create, J/K to move, S to change status. Ctrl+K for everything else.", tone: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300" },
    { Icon: Users, title: "Built for teams", body: "Invite classmates by Gmail. Admin, member and viewer roles.", tone: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
    { Icon: GitMerge, title: "GitHub aware", body: "“Fixes CAP-42” in a merged PR closes the issue for you.", tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
    { Icon: Command, title: "Nothing is lost", body: "Every change is in the activity log, and Ctrl+Z undoes it.", tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  ];

  return (
    <main className="min-h-full bg-gradient-to-b from-indigo-500/10 via-bg to-bg">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-lg font-bold tracking-tight">Stride</span>
        </div>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="rounded-full bg-indigo-500/12 px-3 py-1 text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
              For capstone teams, clubs & class projects
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Plan together.{" "}
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">Ship faster.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              A simple, colorful board for your team’s work — with shortcuts for when you want to go fast.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-[14px] font-semibold text-accent-fg shadow-lg shadow-indigo-500/25 hover:opacity-90"
              >
                Get started — it’s free
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-panel p-3 shadow-2xl shadow-indigo-500/10" aria-hidden>
            {preview.map((col) => {
              const s = STATUS_STYLE[col.status];
              return (
                <div key={col.status} className={cn("overflow-hidden rounded-xl border", s.border, s.soft)}>
                  <div className={cn("h-1", s.solid)} />
                  <div className={cn("px-2.5 py-2 text-[12px] font-semibold", s.text)}>{STATUS_LABEL[col.status]}</div>
                  <div className="space-y-2 px-2 pb-2">
                    {col.cards.map((c) => (
                      <div key={c.title} className={cn("rounded-md border border-l-[3px] border-border bg-panel p-2 text-[11px] font-medium shadow-sm", c.stripe)}>
                        {c.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, body, tone }) => (
            <div key={title} className="rounded-2xl border border-border bg-panel p-5">
              <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
                <Icon size={18} />
              </span>
              <h2 className="mt-3 text-[14px] font-semibold">{title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
