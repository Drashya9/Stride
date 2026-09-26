"use client";

import { PriorityIcon, StatusIcon } from "@/components/icons";
import { PRIORITY_STYLE, STATUS_STYLE } from "@/lib/colors";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, STATUSES, type Priority, type Status } from "@/lib/constants";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/** Color-coded status chips — one click to change. */
export function StatusPicker({
  value,
  onChange,
  disabled,
  label = "Status",
}: {
  value: Status;
  onChange: (s: Status) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {STATUSES.map((s) => {
        const on = s === value;
        const st = STATUS_STYLE[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(s)}
            title={st.hint}
            className={cn(chip, on ? cn(st.soft, st.text, st.border, "ring-1 ring-current/25") : "border-border text-muted hover:bg-hover hover:text-fg")}
          >
            <StatusIcon status={s} size={13} />
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export function PriorityPicker({
  value,
  onChange,
  disabled,
  label = "Priority",
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {PRIORITIES.map((p) => {
        const on = p === value;
        const st = PRIORITY_STYLE[p];
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(p)}
            className={cn(chip, on ? cn(st.soft, st.text, st.border, "ring-1 ring-current/25") : "border-border text-muted hover:bg-hover hover:text-fg")}
          >
            <PriorityIcon priority={p} size={13} />
            {p === "none" ? "None" : PRIORITY_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}
