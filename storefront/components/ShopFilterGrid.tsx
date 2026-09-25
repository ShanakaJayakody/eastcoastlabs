"use client";

import { useEffect, useMemo, useState } from "react";
import type { Collection } from "@/lib/collections";
import ProductCard, { type CardProduct } from "./ProductCard";
import { purchasableStartingPriceMinor } from '@/lib/product-sizes';
import { commerceItem, trackViewItemList } from '@/lib/analytics';
import { minorToMajor } from '@/lib/format';
import { ANALYTICS_CONSENT_EVENT, analyticsConsent } from '@/lib/attribution';
import type { RebrandVariant } from './rebrand/content';

/**
 * Shop grid with research-goal filter pills + a name/SKU search. Filters
 * client-side over a slim product list (no heavy description payload shipped).
 */
export default function ShopFilterGrid({
  products,
  collections,
  imageVariant,
}: {
  products: CardProduct[];
  collections: Collection[];
  imageVariant?: RebrandVariant;
}) {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("featured");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [consentRevision, setConsentRevision] = useState(0);
  useEffect(() => {
    const changed = () => setConsentRevision((revision) => revision + 1);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, changed);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, changed);
  }, []);
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
      list = list.filter((p) => [p.name, p.slug, p.sku, ...(p.sizes?.flatMap((size) => [size.label, size.sku ?? '', size.slug]) ?? [])]
        .some((value) => value.toLowerCase().includes(term)));
    }
    if (inStock) list = list.filter(p => p.is_in_stock !== false);
    if (sort !== "featured") list = [...list].sort((a,b) => sort === "name" ? a.name.localeCompare(b.name) :
      (purchasableStartingPriceMinor(a.sizes,a.prices.price)-purchasableStartingPriceMinor(b.sizes,b.prices.price)) * (sort === "price-desc" ? -1 : 1));
    return list;
  }, [products, collections, active, query, inStock, sort]);

  useEffect(() => {
    if (!urlReady || analyticsConsent() !== 'granted') return;
    trackViewItemList(filtered.map((product) => commerceItem({
      slug: product.slug,
      name: product.name,
      price: minorToMajor(String(purchasableStartingPriceMinor(product.sizes, product.prices.price)), product.prices.currency_minor_unit ?? 2),
    })), 'shop', 'Shop');
  }, [filtered, urlReady, consentRevision]);

  const pill = (isActive: boolean) =>
    `btn-press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
      isActive
        ? "border-accent bg-accent/15 text-accent"
        : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg"
    }`;
  const hasFilters = active !== 'all' || query.trim().length > 0 || inStock || sort !== 'featured';
  const reset = () => { setActive('all'); setQuery(''); setInStock(false); setSort('featured'); };

  return (
    <div className="ecl-shop-filters">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          id="catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, size or SKU…"
          aria-label="Search products"
          className="w-full rounded-lg border border-line bg-ink px-3.5 py-2 text-sm text-fg outline-none transition focus:border-accent sm:order-2 sm:w-64"
        />
        <div className="sm:order-1">
          <button type="button" aria-expanded={categoriesOpen} aria-controls="product-categories" onClick={() => setCategoriesOpen((open) => !open)} className="btn-press flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-fg sm:hidden">
            Product categories{active === 'all' ? '' : ` · ${collections.find((collection) => collection.slug === active)?.name ?? active}`} <span aria-hidden="true">{categoriesOpen ? '−' : '+'}</span>
          </button>
          <div id="product-categories" className={`${categoriesOpen ? 'mt-2 flex' : 'hidden'} flex-wrap gap-2 sm:mt-0 sm:flex`}>
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
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-fg-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)}/>In stock only</label>
        <label>Sort products<select className="ml-2 rounded border border-line bg-ink p-2" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></label>
        <p role="status" className="text-xs text-muted">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
        <button type="button" onClick={reset} className={`text-xs font-medium text-accent underline underline-offset-2 ${hasFilters ? '' : 'opacity-70'}`}>Reset filters</button>
      </div>
      {products.length === 0 && <p className="mt-6 text-sm text-muted">No products are currently available. Please check again later.</p>}
      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
          No compounds match. <button className="text-accent" onClick={reset}>Clear filters</button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} listId="shop" listName="Shop" imageVariant={imageVariant} />
          ))}
        </div>
      )}
    </div>
  );
}
