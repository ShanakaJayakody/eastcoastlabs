// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GuidePage from "@/app/(store)/learn/[slug]/page";

vi.mock("@/lib/catalog", () => ({ getCatalogProducts: async () => new Map() }));
afterEach(cleanup);

it("keeps the article calculator link on the same page with a working calculator target", async () => {
  render(await GuidePage({ params: Promise.resolve({ slug: "reconstituting-research-peptides" }) }));
  const link = screen.getByRole("link", { name: "reconstitution concentration calculator" });
  expect(link).toHaveAttribute("href", "#reconstitution-calculator");
  expect(document.getElementById("reconstitution-calculator")).toContainElement(screen.getByLabelText("Peptide in vial"));
});
