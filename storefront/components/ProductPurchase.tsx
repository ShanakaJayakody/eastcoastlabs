"use client";

import { useState } from 'react';
import Image from 'next/image';
import { normalizeProductSizeLabel, type ProductSizeOption } from '@/lib/product-sizes';
import { formatAud, minorToMajor } from '@/lib/format';
import BuyBox, { type BuyBoxProduct, type BacWaterOption } from './BuyBox';
import EmailCapture from './EmailCapture';
import { commerceItem, trackSelectSize } from '@/lib/analytics';

export default function ProductPurchase({ product, sizes, minorUnit, bacWater, initialSize, evidenceStatus, selectedSlug, onSelectedSizeChange }: {
  product: BuyBoxProduct; sizes: ProductSizeOption[]; minorUnit: number;
  bacWater?: BacWaterOption | null; initialSize?: string; evidenceStatus?: string;
  selectedSlug?: string; onSelectedSizeChange?: (slug: string) => void;
}) {
  const initial = sizes.some((size) => size.slug === initialSize)
    ? initialSize
    : sizes.find((size) => size.available > 0)?.slug ?? sizes[0]?.slug;
  const [internalSelected, setInternalSelected] = useState(initial);
  const selected = selectedSlug ?? internalSelected;
  const size = sizes.find(option => option.slug === selected) ?? sizes[0];
  if (!size) return <p className="text-sm text-muted">No sizes are currently available.</p>;
  const label = normalizeProductSizeLabel(size.label);
  const selectedImage = size.images === undefined ? product.image : size.images[0]?.src;
  const selectSize = (slug: string) => {
    const option = sizes.find((candidate) => candidate.slug === slug);
    if (selectedSlug === undefined) setInternalSelected(slug);
    onSelectedSizeChange?.(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('size', slug);
    window.history.replaceState(window.history.state, '', url);
    if (option) trackSelectSize(commerceItem({
      slug: product.slug, name: product.name, size: normalizeProductSizeLabel(option.label),
      price: minorToMajor(option.priceMinor, minorUnit),
    }));
  };
  return <div className="space-y-4">
    <div aria-live="polite" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      {selectedImage && <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-2"><Image src={selectedImage} alt={`${product.name} ${label}`} fill sizes="64px" className="object-contain p-1" /></div>}
      <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><dt className="text-muted-2">Selected size</dt><dd className="font-semibold text-fg">{label}</dd></div>
        <div><dt className="text-muted-2">SKU</dt><dd className="truncate font-mono font-semibold text-fg">{size.sku || product.sku}</dd></div>
        <div><dt className="text-muted-2">Format</dt><dd className="text-fg-2">Research vial</dd></div>
        <div><dt className="text-muted-2">Availability</dt><dd className={size.available > 0 ? 'text-success' : 'text-warn'}>{size.available > 0 ? `${size.available} vials available` : 'Out of stock'}</dd></div>
      </dl>
    </div>
    {evidenceStatus && <p className="text-xs text-muted">{evidenceStatus}</p>}
    <p data-testid="size-price" aria-live="polite" className="text-2xl font-semibold tracking-tight text-fg">
      {formatAud(minorToMajor(size.priceMinor, minorUnit))}
      <span className="ml-2 text-sm font-normal text-muted">/ vial</span>
    </p>
    <fieldset className="border-t border-line pt-4">
      <legend className="float-left mb-2 w-full text-sm font-medium text-fg">Size</legend>
      <div className="flex clear-both flex-wrap gap-2">
        {sizes.map(option => <label key={option.slug} className={`cursor-pointer rounded-full border px-6 py-2.5 text-sm font-medium focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-ink ${size.slug === option.slug ? 'border-fg bg-fg text-ink' : 'border-line-2 text-fg hover:border-fg'}`}>
          <input type="radio" name="product-size" value={option.slug} checked={size.slug === option.slug}
            onChange={() => selectSize(option.slug)} className="sr-only" aria-label={normalizeProductSizeLabel(option.label)}/>
          {normalizeProductSizeLabel(option.label)}
        </label>)}
      </div>
    </fieldset>
    {size.available > 0 ? <BuyBox key={size.slug}
      product={{...product,id:size.id,slug:size.slug,sku:size.sku || product.sku,image:selectedImage}} tiers={size.tiers}
      singlePriceMinor={size.priceMinor} minorUnit={minorUnit} available={size.available}
      sizeLabel={label} cartKeyPrefix={size.slug===product.slug ? undefined : `size:${size.slug}`}
      analyticsSlug={product.slug} bacWater={bacWater}/>
      : <div role="status" className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-fg">This size is out of stock.</p>
        {sizes.some(option=>option.available>0) && <p className="mt-1 text-sm text-muted">Choose another size to see its price and availability.</p>}
        <div className="mt-4"><EmailCapture key={size.slug} source={`back_in_stock:${size.slug}`} cta="Notify me" successMsg="We'll email you when this size is back."/></div>
      </div>}
  </div>;
}
