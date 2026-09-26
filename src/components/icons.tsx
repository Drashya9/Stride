import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Minus,
  OctagonAlert,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import { PRIORITY_STYLE, STATUS_STYLE } from "@/lib/colors";
import type { Priority, Status } from "@/lib/constants";

const STATUS_ICON = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: CircleDot,
  done: CircleCheck,
  canceled: CircleX,
} as const;

export function StatusIcon({ status, size = 14 }: { status: Status; size?: number }) {
  const Icon = STATUS_ICON[status];
  return <Icon size={size} strokeWidth={2.25} className={STATUS_STYLE[status].icon} aria-hidden />;
}

const PRIORITY_ICON = {
  urgent: OctagonAlert,
  high: SignalHigh,
  medium: SignalMedium,
  low: SignalLow,
  none: Minus,
} as const;

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const Icon = PRIORITY_ICON[priority];
  return <Icon size={size} strokeWidth={2.25} className={PRIORITY_STYLE[priority].icon} aria-hidden />;
}
