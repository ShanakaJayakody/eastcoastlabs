import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("stock attribution shows readable names and quantities across screen sizes", async ({ page }, info) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
  });
  await page.goto("/frame.html?page=stock-admin&bare=1");
  await page.getByRole("button", { name: "Manage stock" }).click();
  const panel = page.getByRole("dialog", { name: "Stock — Research compound · 10 mg" });
  await expect(panel.getByText("Recording stock as")).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Who added stock" })).toBeVisible();
  const history = panel.getByRole("list", { name: "Stock history" });
  await expect(history.getByText("Alex Chen")).toBeVisible();
  await expect(history.getByText("+80")).toBeVisible();
  await expect(history.getByText("Jordan Lee")).toBeVisible();
  await expect(history.getByText("Reversed", { exact: true })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await expect(panel.getByRole("button", { name: /Latest stock receipt/ })).toBeInViewport();
  } else {
    await expect(history.getByText("Alex Chen")).toBeInViewport();
  }
  expect(await panel.textContent()).not.toContain("@example.test");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await panel.evaluate(element => [...element.querySelectorAll("*")].every(child => child.getBoundingClientRect().right <= window.innerWidth + 1))).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await panel.screenshot({ path: info.outputPath("stock-attribution.png") });
  await panel.getByRole("button", { name: "Close stock panel" }).click();
  await expect(page.getByRole("button", { name: "Manage stock" })).toBeFocused();
});
