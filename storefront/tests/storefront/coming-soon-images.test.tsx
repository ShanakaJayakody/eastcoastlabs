// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ComingSoonShelf from "@/components/ComingSoonShelf";
import type { ComingSoonProduct } from "@/lib/coming-soon";

afterEach(cleanup);

it("shows a product image on an upcoming-product card", () => {
  const products = [
    {
      slug: "epitalon",
      name: "Epitalon",
      format: "10mg",
      compound: "Epitalon",
      shortDescription: "A synthetic tetrapeptide used in research.",
      categories: ["longevity-cellular"],
      rank: 1,
      images: [
        {
          src: "https://example.test/epitalon.png",
          alt: "Epitalon 10mg research peptide vial – East Coast Labs Australia",
        },
      ],
    },
  ] as ComingSoonProduct[];

  render(<ComingSoonShelf products={products} />);

  expect(
    screen.getByRole("img", {
      name: "Epitalon 10mg research peptide vial – East Coast Labs Australia",
    }),
  ).toBeInTheDocument();
});
