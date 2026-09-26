import { generateKeyBetween } from "fractional-indexing";
import { describe, expect, it } from "vitest";
import { columnsOf, sortIssues } from "@/lib/board";
import { hasRole } from "@/lib/constants";
import type { BoardDTO, IssueDTO } from "@/lib/types";

const issue = (id: string, status: IssueDTO["status"], position: string) =>
  ({ id, status, position }) as IssueDTO;

describe("ordering", () => {
  it("fractional keys sort correctly with plain string comparison", () => {
    const a = generateKeyBetween(null, null);
    const c = generateKeyBetween(a, null);
    const b = generateKeyBetween(a, c);
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });

  it("columnsOf groups by status and sorts by position, then id", () => {
    const board = {
      issues: [issue("2", "todo", "a1"), issue("1", "todo", "a1"), issue("3", "todo", "a0"), issue("4", "done", "a0")],
    } as BoardDTO;
    const cols = columnsOf(board);
    expect(cols.todo.map((i) => i.id)).toEqual(["3", "1", "2"]);
    expect(cols.done.map((i) => i.id)).toEqual(["4"]);
    expect(cols.backlog).toEqual([]);
    expect(sortIssues(cols.todo[1], cols.todo[2])).toBe(-1);
  });
});

describe("roles", () => {
  it("ranks viewer < member < admin", () => {
    expect(hasRole("admin", "member")).toBe(true);
    expect(hasRole("member", "member")).toBe(true);
    expect(hasRole("viewer", "member")).toBe(false);
    expect(hasRole("member", "admin")).toBe(false);
  });
});
