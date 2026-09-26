import { randomUUID } from "node:crypto";
import { expect, type Browser, type Page } from "@playwright/test";

export function uniqueEmail(name: string) {
  return `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@e2e.test`;
}

export function uniqueKey() {
  const n = Number.parseInt(randomUUID().replace(/-/g, "").slice(0, 10), 16);
  return `E${n.toString(36).toUpperCase().slice(-4).padStart(4, "0")}`;
}

/** Dev login (ALLOW_DEV_LOGIN=true). Each call uses a fresh browser context = a separate user. */
export async function signIn(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(name);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Name (optional)").fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/w");
  return { page, context, email };
}

export async function createWorkspace(page: Page, name: string) {
  const key = uniqueKey();
  await page.goto("/w");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Issue key").fill(key);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/w\/[^/]+$/);
  const slug = new URL(page.url()).pathname.split("/")[2];
  return { key, slug };
}

/** Creates an invite in settings and returns the link. */
export async function invite(page: Page, slug: string, role: "admin" | "member" | "viewer") {
  await page.goto(`/w/${slug}/settings`);
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create link" }).click();
  const link = page.getByTestId("invite-link");
  await expect(link).toBeVisible();
  return (await link.textContent())!.trim();
}

export async function acceptInvite(page: Page, link: string) {
  await page.goto(new URL(link).pathname);
  await page.getByRole("button", { name: /^Accept & join/ }).click();
  await page.waitForURL(/\/w\/[^/]+$/);
}

/** Creates an issue with the keyboard: C, type title, Enter. */
export async function createIssueWithKeyboard(page: Page, title: string) {
  await page.locator("body").press("c");
  await page.getByLabel("Issue title").fill(title);
  await page.getByLabel("Issue title").press("Enter");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}
