import { expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: { from: vi.fn() } }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => db }));

import * as catalog from "@/lib/catalog";

type Product = { slug: string };
type RankProducts = <T extends Product>(products: readonly T[]) => T[];

const rankProducts = (products: readonly Product[]) => {
  const rank = (catalog as typeof catalog & { rankProductsByPopularity?: RankProducts })
    .rankProductsByPopularity;
  return rank?.(products) ?? [];
};

it("puts the approved sales leaders first in the customer-facing featured order", () => {
  const products = [
    "glow",
    "semax",
    "mots-c",
    "tirzepatide",
    "bpc-157",
    "klow",
    "tesamorelin",
    "ghk-cu",
    "retatrutide",
  ].map((slug) => ({ slug }));

  expect(rankProducts(products).slice(0, 8).map((product) => product.slug)).toEqual([
    "retatrutide",
    "ghk-cu",
    "tesamorelin",
    "klow",
    "bpc-157",
    "tirzepatide",
    "mots-c",
    "semax",
  ]);
});

it("keeps unranked products in their existing relative order", () => {
  const products = ["new-zeta", "bpc-157", "new-alpha", "retatrutide"].map((slug) => ({
    slug,
  }));

  expect(rankProducts(products).map((product) => product.slug)).toEqual([
    "retatrutide",
    "bpc-157",
    "new-zeta",
    "new-alpha",
  ]);
});
