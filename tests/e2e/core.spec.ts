import { expect, test } from "@playwright/test";
import { createIssueWithKeyboard, createWorkspace, signIn } from "./helpers";

test("sign in, create a workspace, and drive the board from the keyboard", async ({ browser }) => {
  const { page } = await signIn(browser, "Alice");
  const { key } = await createWorkspace(page, "Keyboard Team");

  await createIssueWithKeyboard(page, "Write the project proposal");
  const card = page.getByTestId(`card-${key}-1`);
  await expect(card).toBeVisible();
  await expect(page.getByTestId("column-todo").getByText("Write the project proposal")).toBeVisible();

  // Focus the card, press S, pick "In Progress" in the palette.
  await card.hover();
  await page.locator("body").press("s");
  await page.getByRole("option", { name: "In Progress" }).click();
  await expect(page.getByTestId("column-in_progress").getByText("Write the project proposal")).toBeVisible();

  // Undo puts it back.
  await page.locator("body").press("Control+z");
  await expect(page.getByTestId("column-todo").getByText("Write the project proposal")).toBeVisible();

  // Command palette search finds it by identifier.
  await page.locator("body").press("Control+k");
  await page.getByPlaceholder("Search issues or type a command…").fill(`${key}-1`);
  await page.getByRole("option", { name: new RegExp(`${key}-1`) }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Write the project proposal");
});

test("shortcut sheet opens with ?", async ({ browser }) => {
  const { page } = await signIn(browser, "Sam");
  await createWorkspace(page, "Shortcut Team");
  await page.locator("body").press("?");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("Try the demo opens a private, pre-filled board without an account", async ({ page }) => {
  await page.goto("/");
  const tryDemo = page.getByRole("button", { name: "Try the demo" });
  test.skip(!(await tryDemo.count()), "ALLOW_DEMO is not enabled on this server");

  await tryDemo.click();
  await page.waitForURL(/\/w\/demo-[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByText("Demo workspace.")).toBeVisible();
  await expect(page.getByText("Start here: try the keyboard shortcuts")).toBeVisible();

  // Guests are members: the keyboard flows work.
  await createIssueWithKeyboard(page, "My first demo issue");
});

test("S starts on the current status, and typing filters it", async ({ browser }) => {
  const { page } = await signIn(browser, "Sid");
  const { key } = await createWorkspace(page, "Status Team");
  await createIssueWithKeyboard(page, "Pick a status");
  const card = page.getByTestId(`card-${key}-1`);

  await card.hover();
  await page.locator("body").press("s");
  // Enter on the untouched menu keeps the current status (Todo), not the first option.
  await expect(page.getByRole("option", { name: /Todo/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("column-todo").getByText("Pick a status")).toBeVisible();

  await card.hover();
  await page.locator("body").press("s");
  await page.keyboard.type("done");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("column-done").getByText("Pick a status")).toBeVisible();
});

test("an open issue has a shareable URL", async ({ browser }) => {
  const { page } = await signIn(browser, "Lin");
  const { key, slug } = await createWorkspace(page, "Link Team");
  await createIssueWithKeyboard(page, "Share me");

  await page.getByTestId(`card-${key}-1`).click();
  await expect(page).toHaveURL(new RegExp(`\?issue=${key}-1$`));
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/w/${slug}$`));

  await page.goto(`/w/${slug}?issue=${key}-1`);
  await expect(page.getByLabel("Title")).toHaveValue("Share me");
});

test("the board page doesn't scroll sideways on a phone", async ({ browser }) => {
  const { page } = await signIn(browser, "Pia");
  await createWorkspace(page, "A team with quite a long workspace name");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "New issue" }).first()).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
