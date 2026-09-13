"use client";

import { useEffect, useState, type ReactNode } from 'react';
import type { ProductSizeOption } from '@/lib/product-sizes';
import { normalizeProductSizeLabel } from '@/lib/product-sizes';
import type { CoaRecord } from '@/lib/coa';
import type { BacWaterOption, BuyBoxProduct } from './BuyBox';
import CoaModule from './CoaModule';
import ProductDescription, { decodeProductEntities } from './ProductDescription';
import ProductGallery from './ProductGallery';
import ProductPurchase from './ProductPurchase';
import ResearchDisclaimer from './ResearchDisclaimer';
import TrustRow from './TrustRow';
import ViewItemTracker from './ViewItemTracker';
import { minorToMajor } from '@/lib/format';

interface SizedProductExperienceProps {
  product: BuyBoxProduct & { description?: string; shortDescription?: string };
  sizes: ProductSizeOption[];
  minorUnit: number;
  initialSize?: string;
  bacWater?: BacWaterOption | null;
  coa: CoaRecord | null;
  supplierEvidence?: ReactNode;
  copyHtml?: string;
  descriptorFallback?: string;
  guideSlug?: string;
  ratingSummary?: ReactNode;
  supportEmail?: string;
}

const textOnly = (value: string) => decodeProductEntities(value
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export default function SizedProductExperience({
  product, sizes, minorUnit, initialSize, bacWater, coa, copyHtml, descriptorFallback,
  guideSlug, ratingSummary, supportEmail, supplierEvidence,
}: SizedProductExperienceProps) {
  const initial = sizes.some((size) => size.slug === initialSize)
    ? initialSize
    : sizes.find((size) => size.available > 0)?.slug ?? sizes[0]?.slug;
  const [selectedSlug, setSelectedSlug] = useState(initial);
  useEffect(() => setSelectedSlug(initial), [initial]);
  const selected = sizes.find((size) => size.slug === selectedSlug) ?? sizes[0];
  if (!selected) return null;
  const label = normalizeProductSizeLabel(selected.label);
  const descriptor = textOnly(selected.shortDescription ?? '')
    || (selected.slug === product.slug ? textOnly(product.shortDescription ?? '') || descriptorFallback : '')
    || `Selected supply: ${label} research vial.`;
  const images = selected.images === undefined
    ? (product.image ? [{ src: product.image, alt: `${product.name} ${label}` }] : [])
    : selected.images;
  const detailHtml = selected.description
    || (selected.slug === product.slug ? product.description || copyHtml : '')
    || `<p>Detailed product copy is not currently published for the ${label} size. Use the selected supply details above and contact support with any identification questions.</p>`;
  const evidenceStatus = coa
    ? `The certificate record below is product-level and is not linked to the selected ${label} supply or a shipment lot. Confirm its applicability before ordering.`
    : `No verified certificate is currently published for the selected ${label} supply. Check the evidence section before ordering.`;

  return <>
    <ViewItemTracker key={product.slug} slug={product.slug} name={product.name} size={label} price={minorToMajor(selected.priceMinor, minorUnit)} />
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
      <div className="order-2 lg:col-start-1 lg:row-start-1 lg:row-span-2">
        <ProductGallery images={images} name={`${product.name} ${label}`} />
      </div>
      <div className="order-1 min-w-0 lg:col-start-2">
        <div className="flex items-center gap-2 text-xs text-muted-2">
          <span className="uppercase tracking-wider">{selected.sku || product.sku}</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${selected.available > 0 ? 'bg-success/15 text-success' : 'bg-warn/15 text-warn'}`}>
            {selected.available > 0 ? 'In stock' : 'Out of stock'}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-fg">{product.name}</h1>
        <p className="mt-1 text-sm font-semibold text-accent">{label} · research vial</p>
        {ratingSummary && <a href="#reviews" className="mt-2 inline-block transition-opacity hover:opacity-80">{ratingSummary}</a>}
        <p className="mt-2 text-sm leading-relaxed text-muted">{descriptor}</p>
        {guideSlug && <a href={`/learn/${guideSlug}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">Read the {product.name} research overview →</a>}
        <ResearchDisclaimer variant="badge" className="mt-3" />
        <a href="#pack-options" className="mt-2 inline-block text-sm text-accent underline">View sizes, prices and availability</a>
      </div>
      <div id="pack-options" className="order-3 min-w-0 scroll-mt-24 lg:col-start-2">
        <ProductPurchase product={product} sizes={sizes} minorUnit={minorUnit} bacWater={bacWater}
          selectedSlug={selected.slug} onSelectedSizeChange={setSelectedSlug} evidenceStatus={evidenceStatus}/>
      </div>
    </div>

    <div className="mt-10"><TrustRow /></div>
    <div className="mt-6">{coa || !supplierEvidence ? <CoaModule record={coa} /> : supplierEvidence}</div>

    <section className="mt-10 grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-semibold text-fg">Product details · {label}</h2>
        <ProductDescription html={detailHtml} />
      </div>
      <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">Purchase information</h3>
        <ul className="mt-3 space-y-3 text-sm text-muted">
          <li>Check certificate availability and confirm that any published record applies to the selected size and batch.</li>
          <li>Orders are prepared after payment confirmation. Shipping options appear at checkout.</li>
          <li><a href="/returns" className="text-accent hover:underline">Read returns and consumer guarantee information.</a></li>
        </ul>
        {supportEmail && <p className="mt-4 text-xs text-muted-2">Questions? <a href={`mailto:${supportEmail}`} className="text-accent">{supportEmail}</a></p>}
      </aside>
    </section>
  </>;
}
