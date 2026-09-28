import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("calculator remains usable and accessible on phone and desktop", async ({ page }, info) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("/calculator.html");
  await page.getByRole("button", { name: "Load example" }).click();
  await expect(page.getByLabel("Concentration result", { exact: true })).toHaveText("5 mg/mL");
  await page.getByText("Convert a sample volume", { exact: true }).click();
  await page.getByLabel("Sample volume", { exact: true }).fill("0.1");
  await expect(page.getByLabel("Peptide in sample", { exact: true })).toHaveText("500 mcg");
  await page.getByLabel("Sample volume unit").selectOption("units");
  await expect(page.getByLabel("Sample volume", { exact: true })).toHaveValue("10");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include("#reconstitution-calculator").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.locator("#reconstitution-calculator").screenshot({ path: info.outputPath("calculator.png") });
  await page.getByLabel("Diluent volume", { exact: true }).fill("0");
  await expect(page.getByLabel("Diluent volume", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Concentration result", { exact: true })).toHaveCount(0);
  await page.getByLabel("Diluent volume", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Peptide in vial", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Reset", exact: true }).press("Tab");
  await expect(page.getByLabel("Peptide in vial", { exact: true })).toBeFocused();
});
