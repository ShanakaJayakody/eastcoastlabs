"use client";

import { useState } from "react";
import type { Collection } from "@/lib/collections";
import SpecimenCard, { type SpecimenProduct } from "./SpecimenCard";

/**
 * 03 / THE CATALOG. Client component only for the filter tabs — all data
 * (products, collections) is fetched server-side and passed in as props, so
 * this never fetches on its own.
 */
export default function CatalogSection({
  products,
  collections,
}: {
  products: SpecimenProduct[];
  collections: Collection[];
}) {
  const [active, setActive] = useState<string>("all");

  const filtered =
    active === "all"
      ? products
      : products.filter((p) => collections.find((c) => c.slug === active)?.products.includes(p.slug));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-serif-display text-3xl text-fg">The compounds</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-data text-[12px] uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={active === "all" ? "text-accent" : "text-muted-2 hover:text-fg"}
          >
            All
          </button>
          {collections.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActive(c.slug)}
              className={active === c.slug ? "text-accent" : "text-muted-2 hover:text-fg"}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        {filtered.map((product) => (
          <SpecimenCard key={product.id} product={product} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full bg-surface p-8 text-center text-sm text-muted">
            No compounds in this category yet.
          </p>
        )}
      </div>
    </div>
  );
}
