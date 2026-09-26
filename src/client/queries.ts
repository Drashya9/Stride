"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Priority, Status } from "@/lib/constants";
import { boardKey } from "@/lib/query-keys";
import type {
  BoardDTO,
  CommentDTO,
  EventDTO,
  IssueDTO,
  IssueMutationResult,
  SearchResultDTO,
} from "@/lib/types";
import { api, ApiError } from "./api";
import { afterPaint, track } from "./metrics";
import { useUI } from "./stores";

export { boardKey };
export const eventsKey = (slug: string, issueId?: string) =>
  (issueId ? ["events", slug, issueId] : ["events", slug]) as readonly string[];

/**
 * v1 sync strategy: poll the whole board every 10 s.
 * (Round 1 replaces this with Server-Sent Events.)
 */
export const BOARD_POLL_MS = 10_000;

export function useBoard(slug: string) {
  return useQuery({
    queryKey: boardKey(slug),
    queryFn: () => api<BoardDTO>(`/api/w/${slug}/board`),
    refetchInterval: BOARD_POLL_MS,
    staleTime: 2_000,
  });
}

/**
 * M2 (cross-client sync latency): when a refetch brings in a change made by
 * someone else, record how long after the server commit it reached this screen.
 * Mount exactly once per workspace (the shell does this).
 */
export function useSyncLatency(board: BoardDTO | undefined) {
  const seen = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (!board) return;
    const prev = seen.current;
    const next = new Map(board.issues.map((i) => [i.id, i.version]));
    seen.current = next;
    if (!prev) return;
    const now = Date.now();
    for (const issue of board.issues) {
      const before = prev.get(issue.id);
      const changed = before === undefined || issue.version > before;
      if (changed && issue.updatedById !== board.me.id) {
        const lag = now - Date.parse(issue.updatedAt);
        if (lag >= 0 && lag < 5 * 60_000) {
          afterPaint(() => track("sync_latency", lag, { kind: before === undefined ? "create" : "update" }));
        }
      }
    }
  }, [board]);
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

export function upsertIssue(qc: QueryClient, slug: string, issue: IssueDTO) {
  qc.setQueryData<BoardDTO>(boardKey(slug), (board) => {
    if (!board) return board;
    const exists = board.issues.some((i) => i.id === issue.id);
    return {
      ...board,
      issues: exists ? board.issues.map((i) => (i.id === issue.id ? issue : i)) : [...board.issues, issue],
    };
  });
}

export function removeIssue(qc: QueryClient, slug: string, issueId: string) {
  qc.setQueryData<BoardDTO>(boardKey(slug), (board) =>
    board ? { ...board, issues: board.issues.filter((i) => i.id !== issueId) } : board,
  );
}

function handleError(qc: QueryClient, slug: string, err: unknown) {
  if (err instanceof ApiError && err.status === 409) {
    const current = (err.details as { current?: IssueDTO } | undefined)?.current;
    if (current) upsertIssue(qc, slug, current);
    else qc.invalidateQueries({ queryKey: boardKey(slug) });
  }
  toast.error(err instanceof Error ? err.message : "Something went wrong");
}

/**
 * v1 mutation pattern: send the request, wait for the server, then write the
 * returned issue into the cache. No optimistic update yet — that's Round 1.
 * M1 (perceived action latency) = input -> the change is painted.
 */
function useIssueMutation<V>(
  slug: string,
  action: string,
  request: (vars: V) => Promise<IssueMutationResult>,
  opts: { undoable?: boolean; onDone?: (res: IssueMutationResult, vars: V) => void } = {},
) {
  const qc = useQueryClient();
  const pushUndo = useUI((s) => s.pushUndo);
  return useMutation({
    mutationFn: async (vars: V) => {
      const t0 = performance.now();
      const res = await request(vars);
      return { res, t0 };
    },
    onSuccess: ({ res, t0 }, vars) => {
      upsertIssue(qc, slug, res.issue);
      if (opts.undoable) pushUndo(res.eventId);
      qc.invalidateQueries({ queryKey: ["events", slug] });
      opts.onDone?.(res, vars);
      afterPaint(() => track("action_latency", performance.now() - t0, { action }));
    },
    onError: (err) => handleError(qc, slug, err),
  });
}

export type MoveVars = { issue: IssueDTO; status: Status; afterId?: string | null; beforeId?: string | null };

export function useMoveIssue(slug: string) {
  return useIssueMutation<MoveVars>(
    slug,
    "move",
    ({ issue, status, afterId, beforeId }) =>
      api(`/api/issues/${issue.id}/move`, { body: { baseVersion: issue.version, status, afterId, beforeId } }),
    { undoable: true },
  );
}

export type UpdateVars = {
  issue: IssueDTO;
  patch: Partial<{ title: string; description: string; priority: Priority; assigneeId: string | null; labelIds: string[] }>;
};

export function useUpdateIssue(slug: string) {
  return useIssueMutation<UpdateVars>(
    slug,
    "update",
    ({ issue, patch }) => api(`/api/issues/${issue.id}`, { method: "PATCH", body: { baseVersion: issue.version, ...patch } }),
    { undoable: true },
  );
}

export type CreateVars = {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  labelIds?: string[];
};

export function useCreateIssue(slug: string, onDone?: (res: IssueMutationResult) => void) {
  return useIssueMutation<CreateVars>(slug, "create", (vars) => api(`/api/w/${slug}/issues`, { body: vars }), {
    onDone,
  });
}

export function useDeleteIssue(slug: string) {
  const qc = useQueryClient();
  const pushUndo = useUI((s) => s.pushUndo);
  return useMutation({
    mutationFn: (issue: IssueDTO) => api<IssueMutationResult>(`/api/issues/${issue.id}`, { method: "DELETE" }),
    onSuccess: (res) => {
      removeIssue(qc, slug, res.issue.id);
      pushUndo(res.eventId);
      qc.invalidateQueries({ queryKey: ["events", slug] });
      toast(`Deleted ${res.issue.identifier}`, { description: "Press Ctrl+Z to undo" });
    },
    onError: (err) => handleError(qc, slug, err),
  });
}

export function useUndo(slug: string) {
  const qc = useQueryClient();
  const popUndo = useUI((s) => s.popUndo);
  return useMutation({
    mutationFn: async () => {
      const eventId = popUndo();
      if (eventId === undefined) return null;
      return api<IssueMutationResult & { deleted: boolean }>(`/api/events/${eventId}/undo`, { method: "POST" });
    },
    onSuccess: (res) => {
      if (!res) {
        toast("Nothing to undo");
        return;
      }
      if (res.deleted) removeIssue(qc, slug, res.issue.id);
      else upsertIssue(qc, slug, res.issue);
      qc.invalidateQueries({ queryKey: ["events", slug] });
      toast.success(`Undid change on ${res.issue.identifier}`);
    },
    onError: (err) => handleError(qc, slug, err),
  });
}

// ---------------------------------------------------------------------------
// Detail data
// ---------------------------------------------------------------------------

export type IssueDetail = {
  issue: IssueDTO;
  githubLinks: { repo: string; number: number; title: string; url: string; state: string }[];
};

export function useIssueDetail(issueId: string | null) {
  return useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => api<IssueDetail>(`/api/issues/${issueId}`),
    enabled: Boolean(issueId),
  });
}

export function useComments(issueId: string | null) {
  return useQuery({
    queryKey: ["comments", issueId],
    queryFn: () => api<CommentDTO[]>(`/api/issues/${issueId}/comments`),
    enabled: Boolean(issueId),
  });
}

export function useAddComment(slug: string, issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<CommentDTO>(`/api/issues/${issueId}/comments`, { body: { body } }),
    onSuccess: (comment) => {
      qc.setQueryData<CommentDTO[]>(["comments", issueId], (list) => [...(list ?? []), comment]);
      qc.invalidateQueries({ queryKey: ["events", slug] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not comment"),
  });
}

export function useEvents(slug: string, issueId?: string) {
  return useQuery({
    queryKey: eventsKey(slug, issueId),
    queryFn: () => api<EventDTO[]>(`/api/w/${slug}/events${issueId ? `?issueId=${issueId}` : "?limit=100"}`),
  });
}

export function useSearch(slug: string, q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", slug, query],
    queryFn: async () => {
      const t0 = performance.now();
      const res = await api<SearchResultDTO[]>(`/api/w/${slug}/search?q=${encodeURIComponent(query)}`);
      track("search_latency", performance.now() - t0, { kind: "title_ilike" });
      return res;
    },
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}
