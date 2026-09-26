"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Copy, GitMerge, Mail, MailWarning, Tag, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/client/api";
import { boardKey, useBoard } from "@/client/queries";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Avatar, LabelChip, RoleBadge } from "@/components/ui/misc";
import { ROLE_STYLE } from "@/lib/colors";
import { hasRole, LABEL_COLORS, ROLES, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type EmailStatus = { provider: "gmail" | "resend" | "none"; from: string | null };

function Section({
  title,
  description,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Users;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-panel p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Couldn't copy — select and copy manually"),
  );
}

const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : "Something went wrong");

export function Settings({
  slug,
  webhookUrl,
  email,
  appIsLocal,
}: {
  slug: string;
  webhookUrl: string;
  email: EmailStatus;
  appIsLocal: boolean;
}) {
  const { data: board } = useBoard(slug);
  if (!board) return null;
  const isAdmin = hasRole(board.role, "admin");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-[13px] text-muted">Manage who’s on {board.workspace.name}, labels, and integrations.</p>
        </div>
        {isAdmin && <Invites slug={slug} email={email} appIsLocal={appIsLocal} />}
        <Members slug={slug} />
        <Labels slug={slug} />
        {isAdmin && <GitHub slug={slug} webhookUrl={webhookUrl} workspaceKey={board.workspace.key} />}
      </div>
    </div>
  );
}

function Members({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: board } = useBoard(slug);
  const refresh = () => qc.invalidateQueries({ queryKey: boardKey(slug) });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api(`/api/w/${slug}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => (refresh(), toast.success("Role updated")),
    onError,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(`/api/w/${slug}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_d, userId) => {
      if (userId === board?.me.id) router.push("/w");
      else refresh();
    },
    onError,
  });

  if (!board) return null;
  const isAdmin = hasRole(board.role, "admin");

  return (
    <Section title={`Members · ${board.members.length}`} icon={Users} tone="bg-sky-500/12 text-sky-600 dark:text-sky-300">
      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-muted">
        {ROLES.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <RoleBadge role={r} /> can {ROLE_STYLE[r].hint}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {board.members.map((m) => {
          const isMe = m.id === board.me.id;
          return (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5" data-testid={`member-${m.email}`}>
              <Avatar name={m.name} email={m.email} image={m.image} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">
                  {m.name ?? m.email} {isMe && <span className="text-muted">(you)</span>}
                </div>
                <div className="truncate text-[12px] text-muted">{m.email}</div>
              </div>
              {isAdmin ? (
                <Select
                  aria-label={`Role for ${m.email}`}
                  value={m.role}
                  onChange={(e) => setRole.mutate({ userId: m.id, role: e.target.value as Role })}
                  className="w-28"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </Select>
              ) : (
                <RoleBadge role={m.role} />
              )}
              {(isAdmin || isMe) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:text-danger"
                  onClick={() => {
                    const msg = isMe ? "Leave this workspace?" : `Remove ${m.name ?? m.email} from the workspace?`;
                    if (window.confirm(msg)) remove.mutate(m.id);
                  }}
                >
                  {isMe ? "Leave" : "Remove"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

type Invite = { id: string; email: string | null; role: Role; expiresAt: string };
type CreatedInvite = Invite & { link: string; emailed: boolean; emailError: string | null };

function Invites({ slug, email: emailSetup, appIsLocal }: { slug: string; email: EmailStatus; appIsLocal: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [last, setLast] = useState<CreatedInvite | null>(null);
  const invites = useQuery({ queryKey: ["invites", slug], queryFn: () => api<Invite[]>(`/api/w/${slug}/invites`) });

  const create = useMutation({
    mutationFn: () => api<CreatedInvite>(`/api/w/${slug}/invites`, { body: { email, role } }),
    onSuccess: (inv) => {
      setLast(inv);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invites", slug] });
      if (inv.emailed) toast.success(`Invite emailed to ${inv.email}`);
      else if (inv.email) toast.warning(`Couldn't email ${inv.email}`, { description: `${inv.emailError ?? "Email failed"} — share the link instead.` });
      else toast.success("Invite link created");
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/w/${slug}/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", slug] }),
    onError,
  });

  return (
    <Section
      title="Invite teammates"
      description="Enter their Gmail (or any email) and we’ll send them a link. Leave it blank to just get a link to share."
      icon={UserPlus}
      tone="bg-indigo-500/12 text-indigo-600 dark:text-indigo-300"
    >
      {emailSetup.provider !== "none" ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-800 dark:text-emerald-200">
          <CircleCheck size={15} />
          Invites are emailed from <strong>{emailSetup.from}</strong> via {emailSetup.provider === "gmail" ? "Gmail" : "Resend"}.
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-200">
          <MailWarning size={15} className="mt-0.5 shrink-0" />
          <span>
            Email isn’t set up yet, so you’ll get a link to share yourself. To send invites from your Gmail, add{" "}
            <code className="font-mono text-[12px]">GMAIL_USER</code> and <code className="font-mono text-[12px]">GMAIL_APP_PASSWORD</code> to{" "}
            <code className="font-mono text-[12px]">.env.local</code> (see README).
          </span>
        </div>
      )}
      {appIsLocal && (
        <p className="mb-4 text-[12px] text-muted">
          Heads-up: links point to <code className="font-mono">localhost</code>, so they only open on this computer. Once deployed to
          Vercel, they’ll work for anyone.
        </p>
      )}

      <form
        className="grid gap-3 sm:grid-cols-[1fr_130px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <Label htmlFor="invite-email">Email (optional)</Label>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@gmail.com" />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {email ? <Mail size={14} /> : <UserPlus size={14} />}
          {create.isPending ? "Sending…" : email ? "Send invite" : "Create link"}
        </Button>
      </form>

      {last && (
        <div
          className={cn(
            "mt-4 rounded-lg border p-3",
            last.emailed ? "border-emerald-500/30 bg-emerald-500/8" : "border-indigo-500/30 bg-indigo-500/8",
          )}
        >
          <p className="mb-2 text-[12px] font-medium">
            {last.emailed ? `✓ Sent to ${last.email}. You can also share this link:` : "Share this link with your teammate:"}
          </p>
          <div className="flex items-center gap-2">
            <code data-testid="invite-link" className="flex-1 truncate rounded bg-bg px-2 py-1 font-mono text-[12px]">
              {last.link}
            </code>
            <Button size="sm" onClick={() => copy(last.link)}>
              <Copy size={13} /> Copy
            </Button>
          </div>
        </div>
      )}

      {invites.data?.length ? (
        <div className="mt-4">
          <h3 className="mb-2 text-[12px] font-semibold text-muted">Pending invites</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <Mail size={14} className="text-muted" />
                <span className="flex-1 truncate">{i.email ?? "Anyone with the link"}</span>
                <RoleBadge role={i.role} />
                <span className="hidden text-[12px] text-muted sm:inline">expires {new Date(i.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <Button variant="ghost" size="sm" className="text-muted hover:text-danger" onClick={() => revoke.mutate(i.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function Labels({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data: board } = useBoard(slug);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[6]);
  const refresh = () => qc.invalidateQueries({ queryKey: boardKey(slug) });

  const create = useMutation({
    mutationFn: () => api(`/api/w/${slug}/labels`, { body: { name, color } }),
    onSuccess: () => (setName(""), refresh()),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/w/${slug}/labels/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError,
  });
  if (!board) return null;
  const isAdmin = hasRole(board.role, "admin");

  return (
    <Section
      title="Labels"
      description={isAdmin ? "Color-coded tags you can add to issues." : "Color-coded tags you can add to issues. Only admins can create or delete labels."}
      icon={Tag}
      tone="bg-pink-500/12 text-pink-600 dark:text-pink-300"
    >
      <div className="flex flex-wrap gap-2">
        {board.labels.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1">
            <LabelChip name={l.name} color={l.color} />
            {isAdmin && (
              <button type="button" aria-label={`Delete label ${l.name}`} onClick={() => remove.mutate(l.id)} className="text-muted hover:text-danger">
                <Trash2 size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {isAdmin && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New label" className="w-48" aria-label="Label name" />
          <div className="flex gap-1">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={cn("h-6 w-6 rounded-full transition-transform", c === color && "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-panel")}
                style={{ background: c }}
              />
            ))}
          </div>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Add label
          </Button>
          {name.trim() && <LabelChip name={name.trim()} color={color} />}
        </form>
      )}
    </Section>
  );
}

type Repo = { id: string; repoFullName: string; webhookSecret: string };

function GitHub({ slug, webhookUrl, workspaceKey }: { slug: string; webhookUrl: string; workspaceKey: string }) {
  const qc = useQueryClient();
  const [repo, setRepo] = useState("");
  const repos = useQuery({ queryKey: ["repos", slug], queryFn: () => api<Repo[]>(`/api/w/${slug}/github`) });
  const link = useMutation({
    mutationFn: () => api<Repo>(`/api/w/${slug}/github`, { body: { repoFullName: repo } }),
    onSuccess: () => (setRepo(""), qc.invalidateQueries({ queryKey: ["repos", slug] })),
    onError,
  });
  const unlink = useMutation({
    mutationFn: (id: string) => api(`/api/w/${slug}/github/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos", slug] }),
    onError,
  });

  return (
    <Section
      title="GitHub"
      description={`Merged pull requests that say “Fixes ${workspaceKey}-12” (or closes / resolves) move that issue to Done automatically.`}
      icon={GitMerge}
      tone="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          link.mutate();
        }}
      >
        <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" aria-label="Repository" className="max-w-xs" />
        <Button type="submit" disabled={!repo.includes("/") || link.isPending}>
          Link repository
        </Button>
      </form>

      {repos.data?.map((r) => (
        <div key={r.id} className="mt-4 rounded-xl border border-border p-4 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {r.repoFullName}
            </span>
            <Button variant="ghost" size="sm" className="text-muted hover:text-danger" onClick={() => window.confirm(`Unlink ${r.repoFullName}?`) && unlink.mutate(r.id)}>
              Unlink
            </Button>
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            <li>
              In GitHub, open <span className="text-fg">{r.repoFullName} → Settings → Webhooks → Add webhook</span>.
            </li>
            <li className="flex flex-wrap items-center gap-2">
              Payload URL: <code className="rounded bg-hover px-1.5 font-mono text-[12px] text-fg">{webhookUrl}</code>
              <button type="button" onClick={() => copy(webhookUrl)} aria-label="Copy URL" className="hover:text-fg">
                <Copy size={12} />
              </button>
            </li>
            <li>
              Content type: <span className="text-fg">application/json</span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              Secret: <code className="rounded bg-hover px-1.5 font-mono text-[12px] text-fg">{r.webhookSecret}</code>
              <button type="button" onClick={() => copy(r.webhookSecret)} aria-label="Copy secret" className="hover:text-fg">
                <Copy size={12} />
              </button>
            </li>
            <li>
              Events: <span className="text-fg">Let me select individual events → Pull requests</span>.
            </li>
          </ol>
          <p className="mt-2 text-[12px] text-muted">
            Local testing: GitHub can’t reach localhost — run <code className="font-mono">pnpm webhook:test</code> instead.
          </p>
        </div>
      ))}
    </Section>
  );
}
