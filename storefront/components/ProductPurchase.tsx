"use client";

import { useState } from 'react';
import type { ProductSizeOption } from '@/lib/product-sizes';
import { formatAud, minorToMajor } from '@/lib/format';
import BuyBox, { type BuyBoxProduct, type BacWaterOption } from './BuyBox';
import EmailCapture from './EmailCapture';

export default function ProductPurchase({ product, sizes, minorUnit, bacWater, initialSize }: {
  product: BuyBoxProduct; sizes: ProductSizeOption[]; minorUnit: number;
  bacWater?: BacWaterOption | null; initialSize?: string;
}) {
  const [selected, setSelected] = useState(initialSize ?? sizes.find(size => size.available > 0)?.slug ?? sizes[0]?.slug);
  const size = sizes.find(option => option.slug === selected) ?? sizes[0];
  if (!size) return <p className="text-sm text-muted">No sizes are currently available.</p>;
  return <div className="space-y-6">
    <p data-testid="size-price" aria-live="polite" className="text-3xl font-semibold tracking-tight text-fg">
      {formatAud(minorToMajor(size.priceMinor, minorUnit))}
      <span className="ml-2 text-sm font-normal text-muted">/ vial</span>
    </p>
    <fieldset className="border-t border-line pt-5">
      <legend className="float-left mb-3 w-full text-sm font-medium text-fg">Size</legend>
      <div className="flex clear-both flex-wrap gap-2.5">
        {sizes.map(option => <label key={option.slug} className={`cursor-pointer rounded-full border px-6 py-2.5 text-sm font-medium transition focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-ink ${size.slug === option.slug ? 'border-fg bg-fg text-ink' : 'border-line-2 text-fg hover:border-fg'}`}>
          <input type="radio" name="product-size" value={option.slug} checked={size.slug === option.slug}
            onChange={() => setSelected(option.slug)} className="sr-only" aria-label={option.label}/>
          {option.label}
        </label>)}
      </div>
    </fieldset>
    {size.available > 0 ? <BuyBox key={size.slug}
      product={{...product,id:size.id,slug:size.slug}} tiers={size.tiers}
      singlePriceMinor={size.priceMinor} minorUnit={minorUnit} available={size.available}
      sizeLabel={size.label} cartKeyPrefix={size.slug===product.slug ? undefined : `size:${size.slug}`} bacWater={bacWater}/>
      : <div role="status" className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-fg">This size is out of stock.</p>
        {sizes.some(option=>option.available>0) && <p className="mt-1 text-sm text-muted">Choose another size to see its price and availability.</p>}
        <div className="mt-4"><EmailCapture key={size.slug} source={`back_in_stock:${size.slug}`} cta="Notify me" successMsg="We'll email you when this size is back."/></div>
      </div>}
  </div>;
}
