"use client";

import { useMemo, useState } from "react";
import type { Collection } from "@/lib/collections";
import ProductCard, { type CardProduct } from "./ProductCard";

/**
 * Shop grid with research-goal filter pills + a name/SKU search. Filters
 * client-side over a slim product list (no heavy description payload shipped).
 */
export default function ShopFilterGrid({
  products,
  collections,
}: {
  products: CardProduct[];
  collections: Collection[];
}) {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = products;
    if (active !== "all") {
      const col = collections.find((c) => c.slug === active);
      const set = new Set(col?.products ?? []);
      list = list.filter((p) => set.has(p.slug));
    }
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
      );
    }
    return list;
  }, [products, collections, active, query]);

  const pill = (isActive: boolean) =>
    `btn-press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
      isActive
        ? "border-accent bg-accent/15 text-accent"
        : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg"
    }`;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill(active === "all")} onClick={() => setActive("all")}>
            All
          </button>
          {collections.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={pill(active === c.slug)}
              onClick={() => setActive(c.slug)}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search compounds…"
          aria-label="Search products"
          className="w-full rounded-lg border border-line bg-ink px-3.5 py-2 text-sm text-fg outline-none transition focus:border-accent sm:w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
          No compounds match. <button className="text-accent" onClick={() => { setActive("all"); setQuery(""); }}>Clear filters</button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
