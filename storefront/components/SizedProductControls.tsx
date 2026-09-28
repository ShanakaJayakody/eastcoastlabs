"use client";

import { useEffect, useState, type ReactNode } from 'react';
import type { ProductSizeOption } from '@/lib/product-sizes';
import { normalizeProductSizeLabel } from '@/lib/product-sizes';
import type { BacWaterOption, BuyBoxProduct } from './BuyBox';
import ProductGallery from './ProductGallery';
import ProductPurchase from './ProductPurchase';
import ResearchDisclaimer from './ResearchDisclaimer';
import ViewItemTracker from './ViewItemTracker';
import { minorToMajor, formatAud } from '@/lib/format';
import ProductFacts from './ProductFacts';

interface SizedProductControlsProps {
  product: BuyBoxProduct;
  sizes: ProductSizeOption[];
  minorUnit: number;
  initialSize?: string;
  bacWater?: BacWaterOption | null;
  certificate: boolean;
  historical: boolean;
  documentation: ReactNode;
  details: Record<string, ReactNode>;
  ratingSummary?: ReactNode;
}

/** Hydrates only the controls; descriptive content is rendered by the server. */
export default function SizedProductControls({
  product, sizes, minorUnit, initialSize, bacWater, certificate, historical,
  documentation, details, ratingSummary,
}: SizedProductControlsProps) {
  const initial = sizes.some((size) => size.slug === initialSize)
    ? initialSize
    : sizes.find((size) => size.available > 0)?.slug ?? sizes[0]?.slug;
  const [selectedSlug, setSelectedSlug] = useState(initial);
  useEffect(() => setSelectedSlug(initial), [initial]);
  const selected = sizes.find((size) => size.slug === selectedSlug) ?? sizes[0];
  if (!selected) return null;
  const label = normalizeProductSizeLabel(selected.label);
  const images = selected.images === undefined
    ? (product.image ? [{ src: product.image, alt: `${product.name} ${label}` }] : [])
    : selected.images;
  return <>
    <ViewItemTracker key={product.slug} slug={product.slug} name={product.name} size={label} price={minorToMajor(selected.priceMinor, minorUnit)} />
    <div className="ecl-product-intro grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:gap-8">
      <div className="col-start-1 row-start-1 lg:row-span-3">
        <ProductGallery images={images} name={`${product.name} ${label}`} />
      </div>
      <div className="col-start-2 row-start-1 min-w-0">
        <div className="text-xs text-muted-2">
          <span className="uppercase tracking-wider">{selected.sku || product.sku}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-fg lg:text-3xl">{product.name}</h1>
        <p className="mt-1 text-sm font-semibold text-accent">{label} · research vial</p>
        <p data-testid="size-price" aria-live="polite" className="mt-2 text-2xl font-semibold text-fg">{formatAud(minorToMajor(selected.priceMinor, minorUnit))}<span className="ml-1 text-xs font-normal text-muted">/ vial</span></p>
        {ratingSummary && <a href="#reviews" className="mt-2 inline-block transition-opacity hover:opacity-80">{ratingSummary}</a>}
      </div>
      <div className="col-span-2 lg:col-span-1 lg:col-start-2">
        <ProductFacts available={selected.available > 0} certificate={certificate} historical={historical} sizeLabel={label}/>
        <ResearchDisclaimer className="mt-2" />
      </div>
      <div id="pack-options" className="col-span-2 min-w-0 scroll-mt-28 lg:col-span-1 lg:col-start-2">
        <ProductPurchase product={product} sizes={sizes} minorUnit={minorUnit} bacWater={bacWater}
          selectedSlug={selected.slug} onSelectedSizeChange={setSelectedSlug} compact/>
      </div>
    </div>

    {documentation}
    {details[selected.slug]}
  </>;
}
