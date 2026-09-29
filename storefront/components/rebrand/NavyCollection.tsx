"use client";

import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight, ArrowUpRight, FlaskConical} from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import {rebrandHref} from '@/lib/rebrand-navigation';
import ProductFinder from './ProductFinder';
import {reportDate} from './report-date';
import type {RebrandProps} from './RebrandExperience';

export default function NavyCollection({
  products,
  collections,
  variant,
  productReports,
}: Pick<RebrandProps, "products" | "collections" | "variant" | "productReports">) {
  const [filter, setFilter] = useState("all");
  const active = collections.find((item) => item.slug === filter);
  const visible = (
    active
      ? products.filter((product) => active.products.includes(product.slug))
      : products
  ).slice(0, 4);
  return (
    <section
      id="collection"
      className="rb-section rb-collection"
      aria-labelledby="rb-collection-title"
    >
      <div className="rb-container">
        <div className="rb-section-heading">
          <div>
            <p className="rb-eyebrow">The peptide collection</p>
            <h2 id="rb-collection-title">Find your research peptide.</h2>
          </div>
          <Link href={rebrandHref('/shop', variant)} className="rb-text-link">
            View all peptides <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="rb-section-description">
          Search the collection. Compare sizes. Find the details you need.
        </p>
        <ProductFinder products={products} variant={variant} />
        <div className="rb-filters" role="group" aria-label="Filter by research area">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Popular peptides
          </button>
          {collections.map((item) => (
            <button
              type="button"
              key={item.slug}
              aria-pressed={filter === item.slug}
              onClick={() => setFilter(item.slug)}
            >
              {item.slug === "metabolic-weight"
                ? "Metabolic research"
                : item.name}
            </button>
          ))}
        </div>
        <p className="sr-only" role="status">Showing {visible.length} {active ? active.name : 'popular'} products.</p>
        <div className="rb-products">
          {visible.map((product) => {
            const supplierReport = productReports.find(
              (item) => item.productSlug === product.slug,
            );
            return (
              <div key={product.id} className="rb-product-with-report">
                <ProductCard
                  product={product}
                  imageVariant={variant}
                  listId={`rebrand_${variant}`}
                  listName="Research collection"
                />
                {supplierReport && (
                  <a
                    className="rb-product-report"
                    href={supplierReport.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open historical supplier report for ${supplierReport.sample}`}
                  >
                    <span>Supplier report <ArrowUpRight size={15} /></span>
                    <small>
                      Historical sample · {supplierReport.sample}
                    </small>
                    <small>
                      {reportDate(supplierReport.testDate)}
                    </small>
                  </a>
                )}
              </div>
            );
          })}
        </div>
        {!visible.length && (
          <div className="rb-empty" role="status">
            <FlaskConical size={30} strokeWidth={1.2} />
            <h3>
              {active
                ? "No products to show in this group."
                : "There are no products to show here."}
            </h3>
            <p>Try the full catalogue, or email us to check availability.</p>
            <Link href={rebrandHref('/shop', variant)} className="rb-text-link">
              Open the catalogue <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="rb-range-note">
          <span>Laboratory research materials</span>
          <span>Lab reports are linked where available. <a href="#standards">Understand what each report covers</a></span>
        </div>
      </div>
    </section>
  );
}

