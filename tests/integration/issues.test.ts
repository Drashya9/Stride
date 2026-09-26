import { beforeAll, describe, expect, it } from "vitest";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { getBoard, searchIssues } from "@/server/services/board";
import { createIssue, deleteIssue, moveIssue, undoEvent, updateIssue } from "@/server/services/issues";
import { columnsOf } from "@/lib/board";
import { setupWorkspace } from "./helpers";

type Setup = Awaited<ReturnType<typeof setupWorkspace>>;
let t: Setup;

beforeAll(async () => {
  t = await setupWorkspace();
});

describe("permissions", () => {
  it("non-members get 404, not 403", async () => {
    await expect(getBoard(t.outsider, t.ws.slug)).rejects.toBeInstanceOf(NotFound);
    await expect(createIssue(t.outsider, t.ws.slug, { title: "x" })).rejects.toBeInstanceOf(NotFound);
  });

  it("viewers can read but not write", async () => {
    const board = await getBoard(t.carol, t.ws.slug);
    expect(board.role).toBe("viewer");
    await expect(createIssue(t.carol, t.ws.slug, { title: "nope" })).rejects.toBeInstanceOf(Forbidden);
  });

  it("only admins can delete", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "to delete" });
    await expect(deleteIssue(t.bob, issue.id)).rejects.toBeInstanceOf(Forbidden);
    await deleteIssue(t.alice, issue.id);
    const board = await getBoard(t.alice, t.ws.slug);
    expect(board.issues.some((i) => i.id === issue.id)).toBe(false);
  });
});

describe("issues", () => {
  it("numbers issues sequentially, even under concurrent creates", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createIssue(t.bob, t.ws.slug, { title: `Concurrent ${i}` })),
    );
    const numbers = results.map((r) => r.issue.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(10);
    expect(numbers[9] - numbers[0]).toBe(9);
  });

  it("rejects a stale write with 409 and returns the current issue", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Original" });
    await updateIssue(t.alice, issue.id, { baseVersion: issue.version, title: "Alice's edit" });
    const err = await updateIssue(t.bob, issue.id, { baseVersion: issue.version, title: "Bob's edit" }).catch((e) => e);
    expect(err).toBeInstanceOf(Conflict);
    expect(err.details.current.title).toBe("Alice's edit");
  });

  it("places moved issues between the requested neighbours", async () => {
    const a = await createIssue(t.bob, t.ws.slug, { title: "A", status: "backlog" });
    const b = await createIssue(t.bob, t.ws.slug, { title: "B", status: "backlog" });
    const c = await createIssue(t.bob, t.ws.slug, { title: "C", status: "backlog" });
    const titles = async () =>
      columnsOf(await getBoard(t.bob, t.ws.slug))
        .backlog.filter((i) => ["A", "B", "C"].includes(i.title))
        .map((i) => i.title);

    // New issues go to the top of their column.
    expect(await titles()).toEqual(["C", "B", "A"]);

    // Move A between C and B.
    await moveIssue(t.bob, a.issue.id, { baseVersion: a.issue.version, status: "backlog", afterId: c.issue.id, beforeId: b.issue.id });
    expect(await titles()).toEqual(["C", "A", "B"]);

    // Move C to the bottom (after B).
    await moveIssue(t.bob, c.issue.id, { baseVersion: c.issue.version, status: "backlog", afterId: b.issue.id, beforeId: null });
    expect(await titles()).toEqual(["A", "B", "C"]);
  });

  it("moves across columns and records an event", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Ship it", status: "todo" });
    const moved = await moveIssue(t.bob, issue.id, { baseVersion: issue.version, status: "in_progress" });
    expect(moved.issue.status).toBe("in_progress");
    expect(moved.issue.version).toBe(issue.version + 1);
    expect(moved.eventId).toBeGreaterThan(0);
  });

  it("rejects assignees who aren't members", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Assign me" });
    await expect(updateIssue(t.bob, issue.id, { baseVersion: issue.version, assigneeId: t.outsider.userId })).rejects.toThrow(
      /not a member/,
    );
  });
});

describe("undo", () => {
  it("undoes my own move", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Undo move", status: "todo" });
    const moved = await moveIssue(t.bob, issue.id, { baseVersion: issue.version, status: "done" });
    const undone = await undoEvent(t.bob, moved.eventId);
    expect(undone.issue.status).toBe("todo");
    expect(undone.issue.position).toBe(issue.position);
    await expect(undoEvent(t.bob, moved.eventId)).rejects.toThrow(/Already undone/);
  });

  it("undoes field edits, including labels", async () => {
    const board = await getBoard(t.bob, t.ws.slug);
    const label = board.labels[0];
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Before", priority: "low" });
    const edited = await updateIssue(t.bob, issue.id, {
      baseVersion: issue.version,
      title: "After",
      priority: "urgent",
      labelIds: [label.id],
    });
    const undone = await undoEvent(t.bob, edited.eventId);
    expect(undone.issue).toMatchObject({ title: "Before", priority: "low", labelIds: [] });
  });

  it("undoes a delete", async () => {
    const { issue } = await createIssue(t.alice, t.ws.slug, { title: "Oops" });
    const deleted = await deleteIssue(t.alice, issue.id);
    const undone = await undoEvent(t.alice, deleted.eventId);
    expect(undone.deleted).toBe(false);
    expect((await getBoard(t.alice, t.ws.slug)).issues.some((i) => i.id === issue.id)).toBe(true);
  });

  it("won't undo someone else's change", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Bob's" });
    const moved = await moveIssue(t.bob, issue.id, { baseVersion: issue.version, status: "done" });
    await expect(undoEvent(t.alice, moved.eventId)).rejects.toBeInstanceOf(Forbidden);
  });

  it("won't undo when the issue changed since", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Changed later" });
    const moved = await moveIssue(t.bob, issue.id, { baseVersion: issue.version, status: "done" });
    await updateIssue(t.alice, issue.id, { baseVersion: moved.issue.version, title: "Alice touched it" });
    await expect(undoEvent(t.bob, moved.eventId)).rejects.toBeInstanceOf(Conflict);
  });
});

describe("search (v1: title substring + identifier)", () => {
  it("finds by title fragment and by KEY-number", async () => {
    const { issue } = await createIssue(t.bob, t.ws.slug, { title: "Fix the flaky login redirect" });
    expect((await searchIssues(t.bob, t.ws.slug, "flaky LOGIN")).map((r) => r.issueId)).toContain(issue.id);
    expect((await searchIssues(t.bob, t.ws.slug, issue.identifier)).map((r) => r.issueId)).toContain(issue.id);
  });

  it("treats % and _ literally", async () => {
    const results = await searchIssues(t.bob, t.ws.slug, "%");
    expect(results.every((r) => r.title.includes("%"))).toBe(true);
  });
});
