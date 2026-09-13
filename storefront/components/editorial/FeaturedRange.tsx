"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProductCard, { type CardProduct } from "@/components/ProductCard";
import type { Collection } from "@/lib/collections";

export default function FeaturedRange({
  products,
  collections,
}: {
  products: CardProduct[];
  collections: Collection[];
}) {
  const [active, setActive] = useState("all");
  const selected = collections.find((collection) => collection.slug === active);
  const visible = (
    selected
      ? products.filter((product) => selected.products.includes(product.slug))
      : products
  ).slice(0, 4);
  return (
    <section
      className="ecl-section ecl-range"
      id="featured"
      aria-labelledby="range-title"
    >
      <div className="ecl-container">
        <div className="ecl-section-heading" data-reveal>
          <div>
            <p className="ecl-eyebrow">01 / THE COLLECTION</p>
            <h2 id="range-title">
              Explore the <em>possibilities.</em>
            </h2>
          </div>
          <Link href="/shop" className="ecl-text-link">
            Shop all compounds <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="ecl-range-tabs" aria-label="Featured research areas">
          <button
            type="button"
            aria-pressed={active === "all"}
            onClick={() => setActive("all")}
          >
            Featured
          </button>
          {collections.map((collection) => (
            <button
              key={collection.slug}
              type="button"
              aria-pressed={active === collection.slug}
              onClick={() => setActive(collection.slug)}
            >
              {collection.name}
            </button>
          ))}
        </div>
        <div className="ecl-product-grid" key={active}>
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {!visible.length && (
          <p className="ecl-empty" role="status">
            This collection is currently being updated.{" "}
            <Link href="/shop">Explore the full range →</Link>
          </p>
        )}
        <div className="ecl-range-foot">
          <span role="status">
            {selected ? selected.name : "Selected from our current catalog"}
          </span>
          <span>
            Single vials & available multi-vial packs <span aria-hidden>↗</span>
          </span>
        </div>
      </div>
    </section>
  );
}
