"use client";

import { GitMerge, Trash2, X } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  useAddComment,
  useBoard,
  useComments,
  useDeleteIssue,
  useEvents,
  useIssueDetail,
  useMoveIssue,
  useUpdateIssue,
} from "@/client/queries";
import { useUI } from "@/client/stores";
import { actorName, describeEvent, EventIcon } from "@/components/activity";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Avatar, PriorityBadge, StatusBadge } from "@/components/ui/misc";
import { PriorityPicker, StatusPicker } from "@/components/ui/pickers";
import { hasRole } from "@/lib/constants";
import type { BoardDTO, IssueDTO } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export function IssueDialog({ slug }: { slug: string }) {
  const openIssueId = useUI((s) => s.openIssueId);
  const openIssue = useUI((s) => s.openIssue);
  const { data: board } = useBoard(slug);
  const issue = board?.issues.find((i) => i.id === openIssueId);

  return (
    <Dialog open={Boolean(issue)} onOpenChange={(o) => !o && openIssue(null)} title={issue ? `${issue.identifier} ${issue.title}` : "Issue"} side="right">
      {issue && board && <IssueDetail key={issue.id} slug={slug} issue={issue} board={board} onClose={() => openIssue(null)} />}
    </Dialog>
  );
}

function IssueDetail({ slug, issue, board, onClose }: { slug: string; issue: IssueDTO; board: BoardDTO; onClose: () => void }) {
  const canEdit = hasRole(board.role, "member");
  const isAdmin = hasRole(board.role, "admin");
  const update = useUpdateIssue(slug);
  const move = useMoveIssue(slug);
  const del = useDeleteIssue(slug);
  const detail = useIssueDetail(issue.id);

  const [title, setTitle] = useState(issue.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(issue.description);

  // Pull in changes that arrive from the server (someone else edited, or a refetch),
  // unless the user has unsaved edits in that field.
  const [synced, setSynced] = useState({ version: issue.version, title: issue.title, description: issue.description });
  if (issue.version !== synced.version) {
    if (title === synced.title) setTitle(issue.title);
    if (!editingDesc) setDesc(issue.description);
    setSynced({ version: issue.version, title: issue.title, description: issue.description });
  }

  const saveTitle = () => {
    const next = title.trim();
    if (next && next !== issue.title) update.mutate({ issue, patch: { title: next } });
    else setTitle(issue.title);
  };
  const saveDesc = () => {
    setEditingDesc(false);
    if (desc !== issue.description) update.mutate({ issue, patch: { description: desc } });
  };
  const toggleLabel = (labelId: string) => {
    const labelIds = issue.labelIds.includes(labelId) ? issue.labelIds.filter((l) => l !== labelId) : [...issue.labelIds, labelId];
    update.mutate({ issue, patch: { labelIds } });
  };

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <div className="flex-1 border-border p-6 md:border-r">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[12px] font-medium text-muted">{issue.identifier}</span>
            <StatusBadge status={issue.status} />
            {issue.priority !== "none" && <PriorityBadge priority={issue.priority} />}
          </div>
          <div className="flex gap-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete issue"
                onClick={() => {
                  if (window.confirm(`Delete ${issue.identifier}? You can undo with Ctrl+Z.`)) {
                    onClose();
                    del.mutate(issue);
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </div>

        <input
          aria-label="Title"
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setTitle(issue.title);
          }}
          className="w-full bg-transparent text-xl font-semibold text-fg outline-none disabled:opacity-100"
        />

        <div className="mt-4">
          {editingDesc ? (
            <div>
              <Textarea
                autoFocus
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDesc();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setDesc(issue.description);
                    setEditingDesc(false);
                  }
                }}
                className="min-h-40"
                placeholder="Add a description (Markdown supported)…"
              />
              <div className="mt-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={saveDesc}>
                  Save
                </Button>
                <Button size="sm" onClick={() => (setDesc(issue.description), setEditingDesc(false))}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={() => canEdit && (setDesc(issue.description), setEditingDesc(true))}
              className={cn("prose-sm min-h-12 rounded-md text-[14px] leading-relaxed", canEdit && "-mx-2 cursor-text px-2 py-1 hover:bg-hover")}
            >
              {issue.description ? (
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{issue.description}</ReactMarkdown>
              ) : (
                <span className="text-muted">{canEdit ? "Add a description…" : "No description"}</span>
              )}
            </div>
          )}
        </div>

        {detail.data?.githubLinks.length ? (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-medium text-muted">Pull requests</h3>
            <ul className="space-y-1">
              {detail.data.githubLinks.map((l) => (
                <li key={`${l.repo}#${l.number}`} className="flex items-center gap-2 text-[13px]">
                  <GitMerge size={14} className="text-accent" />
                  <a href={l.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {l.repo}#{l.number} {l.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Timeline slug={slug} issue={issue} board={board} canComment={canEdit} />
      </div>

      <aside className="w-full shrink-0 space-y-5 border-border bg-subtle p-6 md:w-72 md:border-l">
        <div>
          <Label>Status</Label>
          <StatusPicker value={issue.status} disabled={!canEdit} onChange={(status) => move.mutate({ issue, status })} />
        </div>
        <div>
          <Label>Priority</Label>
          <PriorityPicker
            value={issue.priority}
            disabled={!canEdit}
            onChange={(priority) => update.mutate({ issue, patch: { priority } })}
          />
        </div>
        <div>
          <Label htmlFor="issue-assignee">Assignee</Label>
          <Select
            id="issue-assignee"
            value={issue.assigneeId ?? ""}
            disabled={!canEdit}
            onChange={(e) => update.mutate({ issue, patch: { assigneeId: e.target.value || null } })}
          >
            <option value="">Unassigned</option>
            {board.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Labels</Label>
          <div className="flex flex-wrap gap-1.5">
            {board.labels.map((l) => {
              const on = issue.labelIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleLabel(l.id)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]",
                    on ? "border-border-strong bg-bg text-fg" : "border-dashed border-border text-muted",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-border pt-4 text-[12px] text-muted">
          <div>Created {timeAgo(issue.createdAt)}</div>
          <div>Updated {timeAgo(issue.updatedAt)}</div>
          <div className="mt-1">Version {issue.version}</div>
        </div>
      </aside>
    </div>
  );
}

function Timeline({ slug, issue, board, canComment }: { slug: string; issue: IssueDTO; board: BoardDTO; canComment: boolean }) {
  const events = useEvents(slug, issue.id);
  const comments = useComments(issue.id);
  const add = useAddComment(slug, issue.id);
  const [body, setBody] = useState("");

  type Item = { at: string; key: string; node: React.ReactNode };
  const items: Item[] = [];
  for (const e of events.data ?? []) {
    if (e.type === "comment.created") continue;
    items.push({
      at: e.createdAt,
      key: `e${e.id}`,
      node: (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <EventIcon event={e} size={22} />
          <span className="font-medium text-fg">{actorName(e, board)}</span>
          <span>{describeEvent(e, board)}</span>
          <span>· {timeAgo(e.createdAt)}</span>
        </div>
      ),
    });
  }
  for (const c of comments.data ?? []) {
    const author = board.members.find((m) => m.id === c.authorId);
    items.push({
      at: c.createdAt,
      key: `c${c.id}`,
      node: (
        <div className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-1 flex items-center gap-2 text-[12px]">
            <Avatar name={author?.name} email={author?.email} image={author?.image} size={18} />
            <span className="font-medium">{author?.name ?? "Former member"}</span>
            <span className="text-muted">{timeAgo(c.createdAt)}</span>
          </div>
          <div className="prose-sm text-[13px]">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{c.body}</ReactMarkdown>
          </div>
        </div>
      ),
    });
  }
  items.sort((a, b) => a.at.localeCompare(b.at));

  const submit = () => {
    if (!body.trim()) return;
    add.mutate(body, { onSuccess: () => setBody("") });
  };

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-xs font-medium text-muted">Activity</h3>
      <ol className="space-y-3">
        {items.map((i) => (
          <li key={i.key}>{i.node}</li>
        ))}
      </ol>
      {canComment && (
        <div className="mt-4">
          <Textarea
            aria-label="Comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Leave a comment… (Ctrl+Enter to send)"
            className="min-h-20"
          />
          <div className="mt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
