import { ArrowRightLeft, CirclePlus, GitMerge, MessageSquare, PencilLine, Trash2, Undo2 } from "lucide-react";
import { EVENT_STYLE } from "@/lib/colors";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from "@/lib/constants";
import type { BoardDTO, EventDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVENT_ICON: Record<string, typeof CirclePlus> = {
  "issue.created": CirclePlus,
  "issue.moved": ArrowRightLeft,
  "issue.updated": PencilLine,
  "issue.deleted": Trash2,
  "issue.undone": Undo2,
  "comment.created": MessageSquare,
};

/** Round, color-coded icon per event type (GitHub events get the dark GitHub tint). */
export function EventIcon({ event, size = 28 }: { event: EventDTO; size?: number }) {
  const github = event.meta?.source === "github";
  const Icon = github ? GitMerge : (EVENT_ICON[event.type] ?? PencilLine);
  const tone = github ? EVENT_STYLE.github : (EVENT_STYLE[event.type] ?? EVENT_STYLE["issue.updated"]);
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", tone)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}

/** Turns an event into "moved from Todo to In Progress"-style text. */
export function describeEvent(e: EventDTO, board: BoardDTO | undefined): string {
  const before = e.before ?? {};
  const after = e.after ?? {};
  const memberName = (id: unknown) =>
    typeof id === "string" ? (board?.members.find((m) => m.id === id)?.name ?? "a former member") : "nobody";

  switch (e.type) {
    case "issue.created":
      return "created the issue";
    case "issue.moved":
      if (e.meta?.source === "github") {
        return `closed via ${String(e.meta.repo)}#${String(e.meta.prNumber)}`;
      }
      return before.status === after.status
        ? "reordered the issue"
        : `moved from ${STATUS_LABEL[before.status as Status]} to ${STATUS_LABEL[after.status as Status]}`;
    case "issue.updated": {
      const parts: string[] = [];
      if ("title" in after) parts.push(`renamed it to “${String(after.title)}”`);
      if ("description" in after) parts.push("updated the description");
      if ("priority" in after) parts.push(`set priority to ${PRIORITY_LABEL[after.priority as Priority]}`);
      if ("assigneeId" in after) parts.push(after.assigneeId ? `assigned ${memberName(after.assigneeId)}` : "removed the assignee");
      if ("labelIds" in after) parts.push("changed labels");
      return parts.join(", ") || "updated the issue";
    }
    case "issue.deleted":
      return "deleted the issue";
    case "issue.undone":
      return "undid a change";
    case "comment.created":
      return `commented: “${String(after.excerpt ?? "")}”`;
    default:
      return e.type;
  }
}

export function actorName(e: EventDTO, board: BoardDTO | undefined) {
  if (!e.actorId) return e.meta?.source === "github" ? "GitHub" : "System";
  const m = board?.members.find((x) => x.id === e.actorId);
  return m?.name ?? m?.email ?? "Former member";
}
