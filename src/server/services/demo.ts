import { randomBytes } from "node:crypto";
import { and, count, eq, gt, isNotNull, lt } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { LABEL_COLORS, type Priority, type Status } from "@/lib/constants";
import type { Ctx } from "../ctx";
import type { DB, Executor } from "../db/client";
import { comments, events, issueLabels, issues, labels, memberships, users, workspaces } from "../db/schema";
import { Forbidden } from "../errors";

/**
 * "Try the demo": every visitor gets their own throwaway workspace, seeded with a
 * small student-team project, as a *member*. Nothing is shared between visitors,
 * and everything (workspace, guest, made-up teammates) is deleted after DEMO_TTL_MS.
 *
 * Member, not admin: admins can link GitHub repos, and repo names are globally
 * unique, so a demo admin could squat a real team's repo until the demo expired.
 */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
/** Upper bound on live demo workspaces, so a script can't fill the database. */
export const MAX_ACTIVE_DEMOS = 200;

export class DemoUnavailable extends Error {
  constructor() {
    super("Too many demos are running right now");
  }
}

type Who = "guest" | "priya" | "marcus" | "sofia";
type Label = "Bug" | "Feature" | "Docs" | "Frontend" | "Backend";

const TEAMMATES: { who: Exclude<Who, "guest">; name: string; role: "admin" | "member" }[] = [
  { who: "priya", name: "Priya Shah", role: "admin" },
  { who: "marcus", name: "Marcus Lee", role: "member" },
  { who: "sofia", name: "Sofia Alvarez", role: "member" },
];

const LABELS: { name: Label; color: string }[] = [
  { name: "Bug", color: LABEL_COLORS[0] },
  { name: "Feature", color: LABEL_COLORS[5] },
  { name: "Docs", color: LABEL_COLORS[3] },
  { name: "Frontend", color: LABEL_COLORS[6] },
  { name: "Backend", color: LABEL_COLORS[1] },
];

const WELCOME = `This is your own copy of a demo board. Nobody else can see it, and it's deleted after 24 hours, so change anything.

Things to try:

- **J / K** move between cards, **H / L** between columns
- **S** change status · **P** priority · **A** assign · **I** assign to me
- **C** create an issue · **Enter** open the focused one
- **Ctrl+K** search and run any command
- **Ctrl+Z** undo your last change
- **?** every shortcut`;

type Seed = {
  title: string;
  status: Status;
  priority: Priority;
  assignee?: Who;
  creator: Who;
  labels?: Label[];
  description?: string;
  /** Hours before "now" that the issue was created. */
  ago: number;
  comments?: { by: Who; body: string }[];
};

// Listed in board order within each status.
const ISSUES: Seed[] = [
  { title: "Start here: try the keyboard shortcuts", status: "todo", priority: "high", assignee: "guest", creator: "priya", labels: ["Docs"], description: WELCOME, ago: 1 },
  {
    title: "Login fails when the email has uppercase letters",
    status: "todo",
    priority: "urgent",
    assignee: "marcus",
    creator: "sofia",
    labels: ["Bug", "Backend"],
    description: "Signing up as `Sofia@asu.edu` works, but logging in with the same address says the account doesn't exist. We should lower-case emails before storing and comparing them.",
    ago: 5,
    comments: [
      { by: "marcus", body: "Reproduced. The signup route lower-cases, the login route doesn't. Fix is small." },
      { by: "priya", body: "Can we also add a test for this so it doesn't come back?" },
    ],
  },
  { title: "Add a loading skeleton to the menu page", status: "todo", priority: "medium", assignee: "guest", creator: "sofia", labels: ["Frontend"], ago: 20 },
  { title: "Write the API section of the README", status: "todo", priority: "low", creator: "priya", labels: ["Docs"], ago: 30 },
  { title: "Book a room for the sprint demo", status: "todo", priority: "none", assignee: "priya", creator: "priya", ago: 44 },

  {
    title: "Build the order checkout flow",
    status: "in_progress",
    priority: "high",
    assignee: "sofia",
    creator: "priya",
    labels: ["Feature", "Frontend"],
    description: "Cart → pickup time → confirm. Use the order endpoint Marcus finished last week.",
    ago: 60,
    comments: [{ by: "sofia", body: "Cart and pickup time are done, working on the confirm screen now." }],
  },
  { title: "Set up GitHub Actions for tests", status: "in_progress", priority: "medium", assignee: "marcus", creator: "marcus", labels: ["Backend"], ago: 50 },
  { title: "Design the restaurant detail page", status: "in_progress", priority: "medium", assignee: "guest", creator: "sofia", labels: ["Frontend"], ago: 26 },

  { title: "Push notifications when an order is ready", status: "backlog", priority: "medium", creator: "sofia", labels: ["Feature"], ago: 90 },
  { title: "Dark mode", status: "backlog", priority: "low", creator: "marcus", labels: ["Feature", "Frontend"], ago: 100 },
  { title: "Rate-limit the login endpoint", status: "backlog", priority: "high", creator: "marcus", labels: ["Backend"], ago: 70 },
  { title: "Accessibility pass on forms", status: "backlog", priority: "medium", creator: "priya", labels: ["Frontend"], ago: 80 },
  { title: "Export orders as CSV for the café", status: "backlog", priority: "none", creator: "priya", labels: ["Feature"], ago: 120 },

  { title: "Pick the tech stack", status: "done", priority: "high", assignee: "priya", creator: "priya", labels: ["Docs"], ago: 300 },
  { title: "Create the database schema", status: "done", priority: "high", assignee: "marcus", creator: "priya", labels: ["Backend"], ago: 250 },
  { title: "Order API endpoint", status: "done", priority: "high", assignee: "marcus", creator: "marcus", labels: ["Backend", "Feature"], ago: 200 },
  { title: "Wireframes for the main screens", status: "done", priority: "medium", assignee: "sofia", creator: "sofia", labels: ["Frontend"], ago: 220 },
  { title: "Write the project proposal", status: "done", priority: "medium", assignee: "priya", creator: "priya", labels: ["Docs"], ago: 320 },

  { title: "Native iOS app", status: "canceled", priority: "low", creator: "marcus", labels: ["Feature"], ago: 280 },
];

/** "D" + 4 random letters/digits, e.g. D7KQ2 — matches the workspace key format. */
function randomKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "D" + Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
}

/** Deletes expired demo workspaces (and everything in them), then expired demo users. */
export async function cleanupExpiredDemos(db: Executor, now = new Date()) {
  const ws = await db
    .delete(workspaces)
    .where(and(isNotNull(workspaces.demoExpiresAt), lt(workspaces.demoExpiresAt, now)))
    .returning({ id: workspaces.id });
  const us = await db
    .delete(users)
    .where(and(isNotNull(users.demoExpiresAt), lt(users.demoExpiresAt, now)))
    .returning({ id: users.id });
  return { workspaces: ws.length, users: us.length };
}

/** Creates a guest user and their private demo workspace. Returns the guest to sign in as. */
export async function createDemo(db: DB, { now = new Date(), maxActive = MAX_ACTIVE_DEMOS } = {}) {
  await cleanupExpiredDemos(db, now);
  const [{ n }] = await db
    .select({ n: count() })
    .from(workspaces)
    .where(gt(workspaces.demoExpiresAt, now));
  if (n >= maxActive) throw new DemoUnavailable();

  const expiresAt = new Date(now.getTime() + DEMO_TTL_MS);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const [guest] = await tx.insert(users).values({ name: "Guest", demoExpiresAt: expiresAt }).returning();
    const mates = await tx
      .insert(users)
      .values(TEAMMATES.map((t) => ({ name: t.name, demoExpiresAt: expiresAt })))
      .returning({ id: users.id });
    const ids: Record<Who, string> = { guest: guest.id, priya: mates[0].id, marcus: mates[1].id, sofia: mates[2].id };

    let key = randomKey();
    for (let i = 0; (await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.key, key))).length; i++) {
      if (i > 5) throw new DemoUnavailable();
      key = randomKey();
    }
    const [ws] = await tx
      .insert(workspaces)
      .values({
        name: "Campus Eats (demo)",
        slug: `demo-${key.toLowerCase()}`,
        key,
        issueCounter: ISSUES.length,
        demoExpiresAt: expiresAt,
      })
      .returning();

    await tx.insert(memberships).values([
      { workspaceId: ws.id, userId: guest.id, role: "member" as const },
      ...TEAMMATES.map((t) => ({ workspaceId: ws.id, userId: ids[t.who], role: t.role })),
    ]);
    const labelRows = await tx
      .insert(labels)
      .values(LABELS.map((l) => ({ ...l, workspaceId: ws.id })))
      .returning();
    const labelId = (name: Label) => labelRows.find((l) => l.name === name)!.id;

    // Ordered position keys per column, handed out in list order.
    const positions = new Map<Status, string[]>();
    for (const s of new Set(ISSUES.map((i) => i.status))) {
      positions.set(s, generateNKeysBetween(null, null, ISSUES.filter((i) => i.status === s).length));
    }

    // Numbers follow creation order (oldest first), except the welcome issue, which is always #1.
    const byAge = ISSUES.slice(1).sort((a, b) => b.ago - a.ago);
    const numberOf = (seed: Seed) => (seed === ISSUES[0] ? 1 : byAge.indexOf(seed) + 2);

    const rows = await tx
      .insert(issues)
      .values(
        ISSUES.map((seed) => ({
          workspaceId: ws.id,
          number: numberOf(seed),
          title: seed.title,
          description: seed.description ?? "",
          status: seed.status,
          position: positions.get(seed.status)!.shift()!,
          priority: seed.priority,
          assigneeId: seed.assignee ? ids[seed.assignee] : null,
          creatorId: ids[seed.creator],
          updatedById: ids[seed.creator],
          createdAt: hoursAgo(seed.ago),
          updatedAt: hoursAgo(seed.ago),
        })),
      )
      .returning();

    const links = ISSUES.flatMap((seed, i) => (seed.labels ?? []).map((l) => ({ issueId: rows[i].id, labelId: labelId(l) })));
    if (links.length) await tx.insert(issueLabels).values(links);

    const commentRows = ISSUES.flatMap((seed, i) =>
      (seed.comments ?? []).map((c, j) => ({
        issueId: rows[i].id,
        workspaceId: ws.id,
        authorId: ids[c.by],
        body: c.body,
        createdAt: hoursAgo(Math.max(seed.ago - 1 - j, 0.1)),
      })),
    );
    if (commentRows.length) await tx.insert(comments).values(commentRows);

    // Activity feed: who created what, plus the comments.
    await tx.insert(events).values([
      ...ISSUES.map((seed, i) => ({
        workspaceId: ws.id,
        actorId: ids[seed.creator],
        type: "issue.created",
        issueId: rows[i].id,
        after: { title: seed.title, status: seed.status, priority: seed.priority, version: 1 },
        createdAt: hoursAgo(seed.ago),
      })),
      ...commentRows.map((c) => ({
        workspaceId: ws.id,
        actorId: c.authorId,
        type: "comment.created",
        issueId: c.issueId,
        after: { excerpt: c.body.slice(0, 140) },
        createdAt: c.createdAt,
      })),
    ]);

    return { user: { id: guest.id, name: guest.name }, workspace: { slug: ws.slug, key: ws.key }, expiresAt };
  });
}

export async function isDemoUser(db: Executor, userId: string) {
  const [row] = await db.select({ demoExpiresAt: users.demoExpiresAt }).from(users).where(eq(users.id, userId));
  return Boolean(row?.demoExpiresAt);
}

/** Guests stay inside their demo workspace: no new workspaces, no joining real teams. */
export async function assertNotDemo(ctx: Ctx, action: string) {
  if (await isDemoUser(ctx.db, ctx.userId)) {
    throw new Forbidden(`Demo accounts can't ${action}. Sign in with Google to use Stride for real.`);
  }
}

/** The guest's demo workspace slug, or null if it's gone (expired, or they left it). */
export async function demoWorkspaceFor(ctx: Ctx) {
  const [row] = await ctx.db
    .select({ slug: workspaces.slug })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, ctx.userId), isNotNull(workspaces.demoExpiresAt)));
  return row?.slug ?? null;
}
