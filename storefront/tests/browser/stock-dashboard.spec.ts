import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("dashboard correlates supplied and sold vials by person with order drill-down on desktop and mobile", async ({ page }, info) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
  });
  await page.goto("/frame.html?page=stock-dashboard-admin&bare=1");
  const section = page.getByRole("region", { name: "Stock by person" });
  await expect(section.getByRole("heading", { name: "Stock by person" })).toBeInViewport();
  await expect(section.getByText("FIFO estimate", { exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "View stock for Alex Chen" })).toBeInViewport();
  const jordan = section.getByRole("button", { name: "View stock for Jordan Lee" });
  await jordan.click();
  await expect(jordan).toHaveAttribute("aria-pressed", "true");
  await section.getByRole("textbox", { name: "Search vials" }).fill("Retatrutide 10 mg");
  const sales = section.getByRole("button", { name: "View sales for Jordan Lee: Retatrutide · 10 mg" }).filter({ visible: true });
  await expect(sales).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include("#stock-by-person").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await section.screenshot({ path: info.outputPath("stock-dashboard.png") });
  await sales.click();
  const dialog = page.getByRole("dialog", { name: "Jordan Lee" });
  await expect(dialog.getByRole("link", { name: "ECL-4001" })).toHaveAttribute("href", "/admin/orders/4001");
  await expect(dialog.getByText("15 sold · 5 returned")).toBeVisible();
  await expect(dialog.getByText("10 vials", { exact: true })).toBeVisible();
  const dialogAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(dialogAccessibility.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await dialog.screenshot({ path: info.outputPath("stock-sales.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(sales).toBeFocused();
});
