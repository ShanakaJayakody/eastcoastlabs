// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardProduct } from "@/components/ProductCard";
import type { Collection } from "@/lib/collections";
import FeaturedRange from "@/components/editorial/FeaturedRange";
import ResearchExplorer from "@/components/editorial/ResearchExplorer";
import Documentation from "@/components/editorial/Documentation";
import { labReports } from "@/lib/lab-reports";

vi.mock("@/components/ProductCard", () => ({
  default: ({ product }: { product: CardProduct }) => (
    <a href={`/product/${product.slug}`}>{product.name}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Deterministic test double for next/image.
    <img {...props} alt={props.alt ?? ""} />
  ),
}));
afterEach(cleanup);

it("shows an original supplier report without claiming it verifies current stock", () => {
  render(<Documentation records={[]} reports={labReports} />);
  expect(
    screen.getByRole("link", { name: /Open GLOW report/i }),
  ).toHaveAttribute("href", "/lab-reports/glow-94947.png");
  expect(screen.getByText(/Historical supplier report/)).toBeInTheDocument();
  expect(
    screen.queryByText(/Verified documents are currently unavailable/),
  ).not.toBeInTheDocument();
});

const collections: Collection[] = [
  {
    slug: "recovery",
    name: "Recovery",
    icon: "",
    tagline: "Tissue research",
    description: "",
    products: ["bpc"],
  },
  {
    slug: "cognitive",
    name: "Cognitive",
    icon: "",
    tagline: "Neural research",
    description: "",
    products: ["semax"],
  },
];
const products = [
  { id: 1, slug: "bpc", name: "BPC-157" },
  { id: 2, slug: "semax", name: "Semax" },
] as CardProduct[];

it("filters the featured range by collection and restores the full selection", () => {
  render(<FeaturedRange products={products} collections={collections} />);
  fireEvent.click(screen.getByRole("button", { name: "Cognitive" }));
  expect(screen.getByRole("link", { name: "Semax" })).toHaveAttribute(
    "href",
    "/product/semax",
  );
  expect(
    screen.queryByRole("link", { name: "BPC-157" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cognitive" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Featured" }));
  expect(screen.getByRole("link", { name: "BPC-157" })).toBeInTheDocument();
});

it("offers an explicit recovery path for an empty featured range", () => {
  render(<FeaturedRange products={[]} collections={collections} />);
  expect(
    screen.getByRole("link", { name: "Explore the full range →" }),
  ).toHaveAttribute("href", "/shop");
});

it("allows keyboard focus to preview a collection and keeps its shop link distinct", () => {
  render(
    <ResearchExplorer
      collections={collections.map((collection) => ({
        ...collection,
        image: `/${collection.slug}.png`,
        productName: collection.name,
      }))}
    />,
  );
  fireEvent.focus(screen.getByRole("button", { name: "Preview Cognitive" }));
  expect(
    screen.getByRole("button", { name: "Preview Cognitive" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("img", { name: "Cognitive — Cognitive collection" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Shop Cognitive" })).toHaveAttribute(
    "href",
    "/collections/cognitive",
  );
});

it("does not manufacture certificates when no verified document is available", () => {
  render(<Documentation records={[]} />);
  expect(
    screen.getByText(/Verified documents are currently unavailable/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Read the latest document" }),
  ).not.toBeInTheDocument();
});

it("links directly to a supplied verified document", () => {
  render(
    <Documentation
      records={[
        {
          batch_id: "ECL-TEST",
          compound: "BPC-157",
          purity_pct: 99,
          lab: "Example",
          test_date: "2026-09-01",
          coa_url: "https://example.com/test.pdf",
          lab_verify_url: "",
        },
      ]}
    />,
  );
  expect(
    screen.getByRole("link", { name: "Read the latest document" }),
  ).toHaveAttribute("href", "https://example.com/test.pdf");
  expect(
    screen.queryByText(/Verified documents are currently unavailable/),
  ).not.toBeInTheDocument();
});
