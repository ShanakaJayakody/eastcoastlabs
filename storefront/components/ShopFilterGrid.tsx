"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("featured");
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setInStock(params.get("stock") === "1");
      setActive(params.get("collection") ?? "all");
      const requestedSort = params.get("sort") ?? "featured";
      setSort(["featured","price-asc","price-desc","name"].includes(requestedSort) ? requestedSort : "featured");
      setUrlReady(true);
    };
    restore();
    window.addEventListener("popstate",restore);
    return () => window.removeEventListener("popstate",restore);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    for (const [key,value] of Object.entries({q:query,stock:inStock ? "1" : "",collection:active === "all" ? "" : active,sort:sort === "featured" ? "" : sort})) {
      if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state,"",url);
  },[query,inStock,active,sort,urlReady]);

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
    if (inStock) list = list.filter(p => p.is_in_stock !== false);
    if (sort !== "featured") list = [...list].sort((a,b) => sort === "name" ? a.name.localeCompare(b.name) : (Number(a.prices.price)-Number(b.prices.price)) * (sort === "price-desc" ? -1 : 1));
    return list;
  }, [products, collections, active, query, inStock, sort]);

  const pill = (isActive: boolean) =>
    `btn-press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
      isActive
        ? "border-accent bg-accent/15 text-accent"
        : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg"
    }`;

  return (
    <div className="ecl-shop-filters">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={active === "all"} className={pill(active === "all")} onClick={() => setActive("all")}>
            All
          </button>
          {collections.map((c) => (
            <button
              key={c.slug}
              type="button"
              aria-pressed={active === c.slug} className={pill(active === c.slug)}
              onClick={() => setActive(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <input
          type="search"
          id="catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search compounds…"
          aria-label="Search products"
          className="w-full rounded-lg border border-line bg-ink px-3.5 py-2 text-sm text-fg outline-none transition focus:border-accent sm:w-56"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-fg-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)}/>In stock only</label>
        <label>Sort products<select className="ml-2 rounded border border-line bg-ink p-2" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></label>
        <p role="status" className="text-xs text-muted">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
      </div>
      {products.length === 0 && <p className="mt-6 text-sm text-muted">No products are currently available. Please check again later.</p>}
      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
          No compounds match. <button className="text-accent" onClick={() => { setActive("all"); setQuery(""); setInStock(false); }}>Clear filters</button>
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
