"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { afterPaint, track } from "@/client/metrics";
import { useBoard, useMoveIssue } from "@/client/queries";
import { useUI } from "@/client/stores";
import { StatusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { columnsOf } from "@/lib/board";
import { PRIORITY_STYLE, STATUS_STYLE } from "@/lib/colors";
import { hasRole, STATUS_LABEL, STATUSES, type Status } from "@/lib/constants";
import type { BoardDTO, IssueDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardBody, IssueCard } from "./issue-card";

let boardLoadTracked = false;

export function Board({ slug }: { slug: string }) {
  const { data: board } = useBoard(slug);
  const move = useMoveIssue(slug);
  const focusedIssueId = useUI((s) => s.focusedIssueId);
  const setFocused = useUI((s) => s.setFocused);
  const openIssue = useUI((s) => s.openIssue);
  const openCreate = useUI((s) => s.openCreate);
  const [activeId, setActiveId] = useState<string | null>(null);

  const columns = useMemo(() => columnsOf(board), [board]);
  const canEdit = board ? hasRole(board.role, "member") : false;

  useEffect(() => {
    // Time from navigation start to the first board paint (hard loads only).
    if (board && !boardLoadTracked) {
      boardLoadTracked = true;
      afterPaint(() => track("board_load", performance.now(), { issues: String(board.issues.length) }));
    }
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is reserved for "open issue"; pick up with Space.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  if (!board) return null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const issue = board.issues.find((i) => i.id === active.id);
    if (!issue) return;

    const overId = String(over.id);
    const overIsColumn = overId.startsWith("col:");
    const overIssue = overIsColumn ? null : board.issues.find((i) => i.id === overId);
    const status: Status = overIsColumn ? (overId.slice(4) as Status) : (overIssue?.status ?? issue.status);
    const ids = columns[status].map((i) => i.id);

    let order: string[];
    if (status === issue.status) {
      const from = ids.indexOf(issue.id);
      const to = overIssue ? ids.indexOf(overIssue.id) : ids.length - 1;
      if (from === to) return;
      order = arrayMove(ids, from, to);
    } else {
      order = [...ids];
      let at = overIssue ? order.indexOf(overIssue.id) : order.length;
      // Dropped on the lower half of a card -> place after it.
      const dragged = active.rect.current.translated;
      if (overIssue && dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2) at += 1;
      order.splice(at, 0, issue.id);
    }

    const pos = order.indexOf(issue.id);
    move.mutate({ issue, status, afterId: order[pos - 1] ?? null, beforeId: order[pos + 1] ?? null });
  };

  const activeIssue = activeId ? board.issues.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            issues={columns[status]}
            board={board}
            canEdit={canEdit}
            focusedIssueId={focusedIssueId}
            onOpen={openIssue}
            onFocus={setFocused}
            onCreate={() => openCreate({ status })}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue && (
          <div
            className={cn(
              "rotate-2 cursor-grabbing rounded-lg border border-l-[3px] border-border-strong bg-panel p-2.5 shadow-2xl ring-2 ring-ring/40",
              PRIORITY_STYLE[activeIssue.priority].stripe,
            )}
          >
            <CardBody
              issue={activeIssue}
              assignee={board.members.find((m) => m.id === activeIssue.assigneeId)}
              labels={board.labels.filter((l) => activeIssue.labelIds.includes(l.id))}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  issues,
  board,
  canEdit,
  focusedIssueId,
  onOpen,
  onFocus,
  onCreate,
}: {
  status: Status;
  issues: IssueDTO[];
  board: BoardDTO;
  canEdit: boolean;
  focusedIssueId: string | null;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const members = useMemo(() => new Map(board.members.map((m) => [m.id, m])), [board.members]);
  const labels = useMemo(() => new Map(board.labels.map((l) => [l.id, l])), [board.labels]);

  const style = STATUS_STYLE[status];

  return (
    <section
      data-testid={`column-${status}`}
      className={cn("flex w-[290px] shrink-0 flex-col overflow-hidden rounded-xl border", style.border, style.soft)}
      aria-label={STATUS_LABEL[status]}
    >
      <div className={cn("h-1 shrink-0", style.solid)} />
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2" title={style.hint}>
        <StatusIcon status={status} size={15} />
        <h2 className={cn("text-[13px] font-semibold", style.text)}>{STATUS_LABEL[status]}</h2>
        <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", style.text, "bg-white/70 dark:bg-black/20")}>
          {issues.length}
        </span>
        {canEdit && (
          <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={onCreate} aria-label={`New ${STATUS_LABEL[status]} issue`}>
            <Plus size={14} />
          </Button>
        )}
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 transition-colors",
          isOver && "bg-white/50 dark:bg-white/5",
        )}
      >
        {!issues.length && (
          <div className={cn("mt-1 rounded-lg border border-dashed px-3 py-5 text-center text-[12px]", style.border, style.text)}>
            {canEdit ? (
              <>
                Drop cards here
                {status === "todo" && (
                  <>
                    {" "}
                    or press <kbd className="rounded border border-current/30 px-1 font-sans">C</kbd>
                  </>
                )}
              </>
            ) : (
              "Nothing here yet"
            )}
          </div>
        )}
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              assignee={issue.assigneeId ? members.get(issue.assigneeId) : undefined}
              labels={issue.labelIds.map((id) => labels.get(id)).filter((l) => l !== undefined)}
              focused={issue.id === focusedIssueId}
              onOpen={onOpen}
              onFocus={onFocus}
              disabled={!canEdit}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}
