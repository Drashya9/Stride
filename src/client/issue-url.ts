"use client";

import { useEffect, useRef } from "react";
import type { BoardDTO } from "@/lib/types";
import { useUI } from "./stores";

const PARAM = "issue";

/** Shareable link to an issue: the current page with `?issue=KEY-12`. */
export function issueLink(identifier: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, identifier);
  return url.toString();
}

function replaceParam(identifier: string | null) {
  const url = new URL(window.location.href);
  if (identifier) url.searchParams.set(PARAM, identifier);
  else url.searchParams.delete(PARAM);
  if (url.toString() !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

function identifierInUrl() {
  return new URLSearchParams(window.location.search).get(PARAM);
}

/**
 * Keeps the open issue in the URL (`?issue=KEY-12`) so issues can be linked to.
 * URL → panel on first load and on back/forward; panel → URL whenever it opens or closes.
 * Uses replaceState, so opening issues doesn't pile up history entries.
 */
export function useIssueUrl(board: BoardDTO | undefined) {
  const openIssueId = useUI((s) => s.openIssueId);
  const openIssue = useUI((s) => s.openIssue);
  const ready = useRef(false);

  // Panel → URL. Declared first so on the first render it bails out before the
  // URL has been applied (otherwise it would wipe ?issue= on load).
  const identifier = openIssueId ? board?.issues.find((i) => i.id === openIssueId)?.identifier : undefined;
  useEffect(() => {
    if (!ready.current) return;
    if (identifier) replaceParam(identifier);
    else if (!openIssueId) replaceParam(null);
    // else: open, but not on this board yet (e.g. just created) — leave the URL alone
  }, [identifier, openIssueId]);

  // URL → panel
  useEffect(() => {
    if (!board) return;
    const apply = () => {
      const wanted = identifierInUrl()?.toUpperCase();
      const issue = wanted ? board.issues.find((i) => i.identifier === wanted) : undefined;
      openIssue(issue?.id ?? null);
      if (wanted && !issue) replaceParam(null); // deleted or not on this board: drop the stale link
    };
    if (!ready.current) {
      ready.current = true;
      apply();
    }
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [board, openIssue]);
}
