/**
 * Seeds a demo workspace for local dev and benchmarks.
 *
 *   pnpm db:seed                   # 40 issues
 *   pnpm db:seed --issues=10000    # benchmark dataset (M3/M4)
 *
 * Re-running replaces the DEMO workspace. Users (all dev-login):
 *   alice@stride.test (admin) · bob@stride.test (member) · carol@stride.test (viewer)
 */
import { faker } from "@faker-js/faker";
import { config } from "dotenv";
import { generateNKeysBetween } from "fractional-indexing";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

// The seed wipes the DEMO workspace and links a repo with a known secret: local databases only.
const dbHost = new URL(process.env.DATABASE_URL ?? "postgres://localhost").hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(dbHost) && !process.argv.includes("--allow-remote")) {
  console.error(`Refusing to seed non-local database host "${dbHost}". Pass --allow-remote if you really mean it.`);
  process.exit(1);
}

const { db, pool } = await import("../src/server/db/client");
const schema = await import("../src/server/db/schema");
const { eq } = await import("drizzle-orm");
const { STATUSES, PRIORITIES } = await import("../src/lib/constants");

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const ISSUE_COUNT = Number(arg("issues", "40"));
const KEY = "DEMO";

faker.seed(42);

async function main() {
  const t0 = Date.now();
  const people = [
    { email: "alice@stride.test", name: "Alice Admin", role: "admin" as const },
    { email: "bob@stride.test", name: "Bob Member", role: "member" as const },
    { email: "carol@stride.test", name: "Carol Viewer", role: "viewer" as const },
  ];

  const users = await Promise.all(
    people.map(async (p) => {
      const [u] = await db
        .insert(schema.users)
        .values({ email: p.email, name: p.name })
        .onConflictDoUpdate({ target: schema.users.email, set: { name: p.name } })
        .returning();
      return { ...u, role: p.role };
    }),
  );

  await db.delete(schema.workspaces).where(eq(schema.workspaces.key, KEY));
  await db.delete(schema.githubRepos).where(eq(schema.githubRepos.repoFullName, "stride-demo/app"));

  const [ws] = await db
    .insert(schema.workspaces)
    .values({ name: "Demo Team", slug: "demo", key: KEY, issueCounter: ISSUE_COUNT })
    .returning();
  await db.insert(schema.memberships).values(users.map((u) => ({ workspaceId: ws.id, userId: u.id, role: u.role })));
  const labels = await db
    .insert(schema.labels)
    .values([
      { workspaceId: ws.id, name: "Bug", color: "#ef4444" },
      { workspaceId: ws.id, name: "Feature", color: "#3b82f6" },
      { workspaceId: ws.id, name: "Docs", color: "#22c55e" },
      { workspaceId: ws.id, name: "Frontend", color: "#8b5cf6" },
      { workspaceId: ws.id, name: "Backend", color: "#f97316" },
    ])
    .returning();
  await db.insert(schema.githubRepos).values({
    workspaceId: ws.id,
    repoFullName: "stride-demo/app",
    webhookSecret: "dev-webhook-secret",
    createdBy: users[0].id,
  });

  // Distribute issues across columns; generate ordered keys per column in one go.
  const weights = { backlog: 0.3, todo: 0.25, in_progress: 0.15, done: 0.25, canceled: 0.05 };
  const perStatus = STATUSES.map((s, i) =>
    i === STATUSES.length - 1
      ? ISSUE_COUNT - STATUSES.slice(0, -1).reduce((n, x) => n + Math.round(ISSUE_COUNT * weights[x]), 0)
      : Math.round(ISSUE_COUNT * weights[s]),
  );

  let number = 0;
  const rows: (typeof schema.issues.$inferInsert)[] = [];
  STATUSES.forEach((status, si) => {
    const keys = generateNKeysBetween(null, null, perStatus[si]);
    for (const position of keys) {
      number++;
      const assignee = faker.helpers.maybe(() => faker.helpers.arrayElement(users.slice(0, 2)), { probability: 0.6 });
      rows.push({
        workspaceId: ws.id,
        number,
        title: `${faker.hacker.verb()} ${faker.hacker.adjective()} ${faker.hacker.noun()}`.replace(/^\w/, (c) => c.toUpperCase()),
        description: faker.helpers.maybe(() => faker.lorem.paragraphs({ min: 1, max: 2 }), { probability: 0.5 }) ?? "",
        status,
        position,
        priority: faker.helpers.arrayElement(PRIORITIES),
        assigneeId: assignee?.id ?? null,
        creatorId: users[0].id,
        updatedById: users[0].id,
        createdAt: faker.date.recent({ days: 30 }),
      });
    }
  });

  const BATCH = 1000;
  const inserted: { id: string }[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    inserted.push(...(await db.insert(schema.issues).values(rows.slice(i, i + BATCH)).returning({ id: schema.issues.id })));
  }

  const links = inserted.flatMap((iss) =>
    faker.helpers.arrayElements(labels, { min: 0, max: 2 }).map((l) => ({ issueId: iss.id, labelId: l.id })),
  );
  for (let i = 0; i < links.length; i += BATCH) await db.insert(schema.issueLabels).values(links.slice(i, i + BATCH));

  const comments = inserted
    .filter(() => faker.datatype.boolean({ probability: 0.3 }))
    .map((iss) => ({
      issueId: iss.id,
      workspaceId: ws.id,
      authorId: faker.helpers.arrayElement(users.slice(0, 2)).id,
      body: faker.lorem.sentences({ min: 1, max: 3 }),
    }));
  for (let i = 0; i < comments.length; i += BATCH) await db.insert(schema.comments).values(comments.slice(i, i + BATCH));

  await db.insert(schema.events).values(
    inserted.slice(0, Math.min(inserted.length, 200)).map((iss) => ({
      workspaceId: ws.id,
      actorId: users[0].id,
      type: "issue.created",
      issueId: iss.id,
      after: { version: 1 },
    })),
  );

  console.log(
    `Seeded workspace "${ws.name}" (/w/${ws.slug}) with ${rows.length} issues, ${comments.length} comments in ${Date.now() - t0}ms.`,
  );
  console.log("Sign in with dev login as alice@stride.test (admin), bob@stride.test (member) or carol@stride.test (viewer).");
  console.log('Linked repo "stride-demo/app" with webhook secret "dev-webhook-secret" — try: pnpm webhook:test');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
