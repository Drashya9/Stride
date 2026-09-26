export const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

export const ROLES = ["admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2 };

export function hasRole(role: Role, min: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

/** Event types an actor can undo. */
export const UNDOABLE_EVENTS = ["issue.updated", "issue.moved", "issue.deleted"] as const;
export const UNDO_WINDOW_MS = 15 * 60 * 1000;

export const METRIC_NAMES = ["action_latency", "sync_latency", "search_latency", "board_load"] as const;
export type MetricName = (typeof METRIC_NAMES)[number];
