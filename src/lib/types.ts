import type { Priority, Role, Status } from "./constants";

/** JSON shapes returned by the API (dates are ISO strings). */

export type IssueDTO = {
  id: string;
  number: number;
  identifier: string;
  title: string;
  description: string;
  status: Status;
  position: string;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string | null;
  updatedById: string | null;
  labelIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type MemberDTO = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
};

export type LabelDTO = { id: string; name: string; color: string };

export type WorkspaceDTO = { id: string; slug: string; name: string; key: string };

export type BoardDTO = {
  workspace: WorkspaceDTO;
  role: Role;
  me: { id: string };
  members: MemberDTO[];
  labels: LabelDTO[];
  issues: IssueDTO[];
};

export type EventDTO = {
  id: number;
  type: string;
  actorId: string | null;
  issueId: string | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type CommentDTO = {
  id: string;
  issueId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
};

export type SearchResultDTO = {
  kind: "issue";
  issueId: string;
  identifier: string;
  title: string;
  status: Status;
};

/** Every successful issue mutation returns the new issue and the event it produced (for undo). */
export type IssueMutationResult = { issue: IssueDTO; eventId: number };

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
