"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useBoard, useCreateIssue } from "@/client/queries";
import { useUI } from "@/client/stores";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Select, Textarea } from "@/components/ui/input";
import { PriorityPicker, StatusPicker } from "@/components/ui/pickers";
import { StatusIcon } from "@/components/icons";
import { STATUS_LABEL, type Priority, type Status } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CreateIssueDialog({ slug }: { slug: string }) {
  const open = useUI((s) => s.createOpen);
  const close = useUI((s) => s.closeCreate);
  const defaults = useUI((s) => s.createDefaults);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()} title="Create issue">
      {open && <CreateIssueForm key={defaults.status ?? "todo"} slug={slug} defaultStatus={defaults.status ?? "todo"} onClose={close} />}
    </Dialog>
  );
}

function CreateIssueForm({ slug, defaultStatus, onClose }: { slug: string; defaultStatus: Status; onClose: () => void }) {
  const { data: board } = useBoard(slug);
  const setFocused = useUI((s) => s.setFocused);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("none");
  const [assigneeId, setAssigneeId] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [createMore, setCreateMore] = useState(false);

  const create = useCreateIssue(slug, (res) => {
    toast.success(`Created ${res.issue.identifier}`);
    setFocused(res.issue.id);
    if (createMore) {
      setTitle("");
      setDescription("");
    } else onClose();
  });

  const submit = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate({ title: title.trim(), description, status, priority, assigneeId: assigneeId || null, labelIds });
  };

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-muted">
        <span className="rounded-md bg-indigo-500/12 px-1.5 py-0.5 text-indigo-700 dark:text-indigo-300">{board?.workspace.key}</span>
        {board?.workspace.name} › New issue in
        <span className="inline-flex items-center gap-1 text-fg">
          <StatusIcon status={status} size={12} /> {STATUS_LABEL[status]}
        </span>
      </div>
      <input
        autoFocus
        aria-label="Issue title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Issue title"
        className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted"
      />
      <Textarea
        aria-label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add description… (Markdown)"
        className="mt-3 border-transparent bg-transparent px-0 focus:border-transparent focus:ring-0"
      />

      <div className="mt-2 space-y-3">
        <div>
          <Label>Status</Label>
          <StatusPicker value={status} onChange={setStatus} />
        </div>
        <div>
          <Label>Priority</Label>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="max-w-xs">
          <Label htmlFor="new-assignee">Assignee</Label>
          <Select id="new-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {board?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {board?.labels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {board.labels.map((l) => {
            const on = labelIds.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => setLabelIds(on ? labelIds.filter((x) => x !== l.id) : [...labelIds, l.id])}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]",
                  on ? "border-border-strong bg-subtle text-fg" : "border-dashed border-border text-muted",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input type="checkbox" checked={createMore} onChange={(e) => setCreateMore(e.target.checked)} />
          Create more
        </label>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || create.isPending}>
            Create issue
          </Button>
        </div>
      </div>
    </form>
  );
}
