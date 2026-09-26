import { expect, test } from "@playwright/test";
import { acceptInvite, createIssueWithKeyboard, createWorkspace, invite, signIn } from "./helpers";

/**
 * Two users on one board. v1 syncs by polling every 10 s, so changes from the
 * other user should appear within ~10 s without a refresh. The measured delay
 * is printed — that's the M2 baseline.
 */
test("a teammate sees my changes without refreshing", async ({ browser }) => {
  const alice = await signIn(browser, "Alice");
  const { slug, key } = await createWorkspace(alice.page, "Sync Team");
  const link = await invite(alice.page, slug, "member");

  const bob = await signIn(browser, "Bob");
  await acceptInvite(bob.page, link);
  await expect(bob.page.getByTestId("column-todo")).toBeVisible();

  await alice.page.goto(`/w/${slug}`);
  const t0 = Date.now();
  await createIssueWithKeyboard(alice.page, "Set up CI");
  await expect(bob.page.getByTestId(`card-${key}-1`)).toBeVisible({ timeout: 15_000 });
  console.log(`[M2 baseline] create visible to teammate after ${Date.now() - t0} ms`);

  // Alice moves it; Bob sees it in the new column.
  await alice.page.getByTestId(`card-${key}-1`).hover();
  await alice.page.locator("body").press("s");
  await alice.page.getByRole("option", { name: "Done" }).click();
  await expect(alice.page.getByTestId("column-done").getByTestId(`card-${key}-1`)).toBeVisible();
  const t1 = Date.now();
  await expect(bob.page.getByTestId("column-done").getByTestId(`card-${key}-1`)).toBeVisible({ timeout: 15_000 });
  console.log(`[M2 baseline] move visible to teammate after ${Date.now() - t1} ms`);
});

test("viewers can't edit, in the UI or through the API", async ({ browser }) => {
  const alice = await signIn(browser, "Alice");
  const { slug, key } = await createWorkspace(alice.page, "Viewer Team");
  await alice.page.goto(`/w/${slug}`);
  await createIssueWithKeyboard(alice.page, "Read-only issue");
  const link = await invite(alice.page, slug, "viewer");

  const carol = await signIn(browser, "Carol");
  await acceptInvite(carol.page, link);
  await expect(carol.page.getByTestId(`card-${key}-1`)).toBeVisible();
  await expect(carol.page.getByRole("button", { name: "New issue" })).toHaveCount(0);

  // "c" does nothing for viewers.
  await carol.page.locator("body").press("c");
  await expect(carol.page.getByLabel("Issue title")).toHaveCount(0);

  // The API enforces it too.
  const res = await carol.page.request.post(`/api/w/${slug}/issues`, { data: { title: "sneaky" } });
  expect(res.status()).toBe(403);
});

test("outsiders get 404 for a workspace they're not in", async ({ browser }) => {
  const alice = await signIn(browser, "Alice");
  const { slug } = await createWorkspace(alice.page, "Private Team");
  const mallory = await signIn(browser, "Mallory");
  const res = await mallory.page.request.get(`/api/w/${slug}/board`);
  expect(res.status()).toBe(404);
});
