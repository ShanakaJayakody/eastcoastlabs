"use client";

import './rebrand/vial-imagery.css';

import Link from "next/link";
import Image from "next/image";
import type { WooProduct } from "@/lib/woo";
import { minorToMajor, formatMinor, formatAud } from "@/lib/format";
import { type TierCard } from "@/lib/pricing";
import Stars from "./Stars";
import { normalizeProductSizeLabel, purchasableStartingPriceMinor, type ProductSizeOption } from '@/lib/product-sizes';
import { commerceItem, trackSelectItem } from '@/lib/analytics';
import type { RebrandVariant } from './rebrand/content';
import { rebrandHref, rebrandImageVariant } from '@/lib/rebrand-navigation';

/** The subset of a product a card needs — lets callers pass slim objects. */
export type CardProduct = Pick<
  WooProduct,
  "id" | "name" | "slug" | "sku" | "is_in_stock" | "images" | "prices"
> & {
  /** Attached by server callers via decorateCards() — cards never fetch. */
  rating?: { rating: number; count: number } | null;
  /** Pack tiers from the DB catalog. Present => the card prices from real
   *  variants; absent => fall back to the static price table. */
  tiers?: TierCard[] | null;
  sizes?: ProductSizeOption[];
};

export default function ProductCard({ product, listId, listName, imageVariant }: { product: CardProduct; listId?: string; listName?: string; imageVariant?: RebrandVariant }) {
  const href = rebrandHref(`/product/${product.slug}`, imageVariant);
  const img = product.images?.[0];
  const single = product.sizes?.length
    ? minorToMajor(String(purchasableStartingPriceMinor(product.sizes, product.prices.price)), product.prices.currency_minor_unit)
    : minorToMajor(product.prices.price, product.prices.currency_minor_unit);
  // Prefer the product's own tiers (DB truth); the price table is the fallback
  // for anything the DB hasn't answered for.
  const perVialLabel = product.tiers?.length
    ? `from ${formatAud(Math.min(...product.tiers.map((t) => t.perVial)))}/vial`
    : `${formatAud(single)}/vial`;
  const inStock = product.is_in_stock !== false;
  const rating = product.rating ?? null;
  const trackSelection = (size?: ProductSizeOption) => {
    if (!listId) return;
    trackSelectItem(commerceItem({
      slug: product.slug,
      name: product.name,
      size: size ? normalizeProductSizeLabel(size.label) : undefined,
      price: size ? minorToMajor(size.priceMinor, product.prices.currency_minor_unit) : single,
    }), listId, listName);
  };

  return (
    <article className="ecl-product-card card-hover group flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-accent/50">
      <Link href={href} onClick={() => trackSelection()} data-vial-theme={rebrandImageVariant(img?.src)} className="ecl-product-image relative block aspect-square overflow-hidden bg-ink-2">
        {img ? (
          <Image
            src={img.src}
            unoptimized={Boolean(rebrandImageVariant(img.src))}
            alt={img.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl text-muted-2">🧪</div>
        )}
        <span
          className={`ecl-stock-label absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            inStock ? "bg-success/15 text-success" : "bg-warn/15 text-warn"
          }`}
        >
          {inStock ? "In stock" : "Out of stock"}
        </span>
      </Link>

      <div className="ecl-product-details flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-semibold text-fg"><Link href={href} onClick={() => trackSelection()}>{product.name}</Link></h3>
        {rating ? (
          <div className="flex items-center gap-1.5">
            <Stars rating={rating.rating} size={12} />
            <span className="text-[11px] text-muted-2">
              {rating.rating.toFixed(1)} ({rating.count})
            </span>
          </div>
        ) : (
          <p className="text-[11px] uppercase tracking-wider text-muted-2">{product.sku}</p>
        )}
        <div className="mt-auto pt-3">
          {product.sizes?.length ? <div><p className="text-sm font-semibold text-fg">From {formatAud(single)} / vial</p><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">{product.sizes.map(size=><Link key={size.slug} href={rebrandHref(`/product/${product.slug}?size=${encodeURIComponent(size.slug)}`, imageVariant)} onClick={() => trackSelection(size)} className={size.available > 0 ? 'text-accent hover:underline' : 'text-muted-2 line-through'}>{normalizeProductSizeLabel(size.label)}</Link>)}</div></div> : perVialLabel ? (
            <div><p className="text-sm font-semibold text-fg">{formatAud(single)} · 1 vial</p><p className="mt-1 text-xs text-accent">{perVialLabel}{product.tiers?.length ? ` with ${product.tiers.reduce((a,b) => a.perVial < b.perVial ? a : b).vials}-vial pack` : ""}</p></div>
          ) : (
            <p className="text-sm font-semibold text-fg">
              {formatMinor(product.prices.price, product.prices)}
            </p>
          )}
          <Link href={href} onClick={() => trackSelection()} className="mt-1 block text-xs text-muted-2 group-hover:text-fg-2">{product.sizes?.length ? 'Choose size' : 'View pack options'} →</Link>
        </div>
      </div>
    </article>
  );
}
