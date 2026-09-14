import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
  });
});

test("admins can edit customer details with accessible fields at every screen size", async ({ page }, info) => {
  await page.goto("/frame.html?page=customer-admin&bare=1");
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Taylor Updated");
  await page.getByLabel("Email", { exact: true }).fill("corrected@example.test");
  await page.getByLabel("Address line 1").fill("25 Updated Street");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include("main").analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("customer-edit.png"), fullPage: true });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Taylor Updated" })).toBeVisible();
  await expect(page.getByText("corrected@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText("25 Updated Street", { exact: true })).toBeVisible();
});

test("a rejected customer save preserves the draft", async ({ page }) => {
  await page.goto("/frame.html?page=customer-admin&bare=1&save=error");
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Email", { exact: true }).fill("taken@example.test");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("already in use");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("taken@example.test");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("taylor@example.test", { exact: true })).toBeVisible();
});
