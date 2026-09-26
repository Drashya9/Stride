"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquareText } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { Avatar, LabelChip, PriorityBadge } from "@/components/ui/misc";
import { PRIORITY_STYLE } from "@/lib/colors";
import type { IssueDTO, LabelDTO, MemberDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  issue: IssueDTO;
  assignee?: MemberDTO;
  labels: LabelDTO[];
  focused: boolean;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
};

export function CardBody({ issue, assignee, labels }: Pick<Props, "issue" | "assignee" | "labels">) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-muted">{issue.identifier}</span>
        {assignee ? (
          <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size={20} />
        ) : (
          <span title="Unassigned" className="h-5 w-5 rounded-full border border-dashed border-border-strong" />
        )}
      </div>
      <div className="mt-1 line-clamp-3 text-[13px] leading-snug font-medium text-fg">{issue.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {issue.priority !== "none" && <PriorityBadge priority={issue.priority} />}
        {labels.map((l) => (
          <LabelChip key={l.id} name={l.name} color={l.color} />
        ))}
        {issue.description && (
          <span title="Has a description" className="text-muted">
            <MessageSquareText size={12} />
          </span>
        )}
      </div>
    </>
  );
}

export const IssueCard = memo(function IssueCard({
  issue,
  assignee,
  labels,
  focused,
  onOpen,
  onFocus,
  disabled,
}: Props & { disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { status: issue.status },
    disabled,
  });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focused]);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        ref.current = node;
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-issue-id={issue.id}
      data-testid={`card-${issue.identifier}`}
      onClick={() => onOpen(issue.id)}
      onMouseEnter={() => onFocus(issue.id)}
      className={cn(
        "group cursor-pointer rounded-lg border border-l-[3px] border-border bg-panel p-2.5 select-none",
        "shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-[box-shadow,border-color] hover:shadow-md",
        "focus-visible:outline-none",
        PRIORITY_STYLE[issue.priority].stripe,
        focused && "ring-2 ring-ring/70",
        isDragging && "opacity-40",
        disabled ? "cursor-pointer" : "active:cursor-grabbing",
      )}
    >
      <CardBody issue={issue} assignee={assignee} labels={labels} />
    </div>
  );
});
