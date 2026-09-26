import { STATUSES, type Status } from "./constants";
import type { BoardDTO, IssueDTO } from "./types";

/** Board order: fractional position (byte order), ties broken by id. */
export function sortIssues(a: IssueDTO, b: IssueDTO) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function columnsOf(board: BoardDTO | undefined): Record<Status, IssueDTO[]> {
  const cols = Object.fromEntries(STATUSES.map((s) => [s, [] as IssueDTO[]])) as Record<Status, IssueDTO[]>;
  for (const issue of board?.issues ?? []) cols[issue.status].push(issue);
  for (const s of STATUSES) cols[s].sort(sortIssues);
  return cols;
}
