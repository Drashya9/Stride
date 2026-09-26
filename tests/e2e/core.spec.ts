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
