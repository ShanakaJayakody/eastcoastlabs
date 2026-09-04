import Link from "next/link";
import Image from "next/image";
import type { WooProduct } from "@/lib/woo";
import { minorToMajor, formatMinor, formatAud } from "@/lib/format";
import { fromPerVialLabel, type TierCard } from "@/lib/pricing";
import SquareStars from "./SquareStars";

export type SpecimenProduct = Pick<
  WooProduct,
  "id" | "name" | "slug" | "sku" | "is_in_stock" | "images" | "prices" | "short_description"
> & {
  rating?: { rating: number; count: number } | null;
  /** Pack tiers from the DB catalog. Present => the card prices from real
   *  variants; absent => fall back to the static price table. */
  tiers?: TierCard[] | null;
};

/**
 * Product card restyled as a specimen plate: dark viewport for the (dark-shot)
 * product photography, mono microlabel, text-only stock state, one CTA. Cards
 * share borders like a contact sheet rather than floating individually.
 */
export default function SpecimenCard({ product }: { product: SpecimenProduct }) {
  const img = product.images?.[0];
  const single = minorToMajor(product.prices.price, product.prices.currency_minor_unit);
  // Prefer the product's own tiers (DB truth); the price table is the fallback
  // for anything the DB hasn't answered for.
  const perVialLabel = product.tiers?.length
    ? `from ${formatAud(Math.min(...product.tiers.map((t) => t.perVial)))}/vial`
    : fromPerVialLabel(product.slug, product.name, single);
  const inStock = product.is_in_stock !== false;
  const rating = product.rating ?? null;
  const descriptor = product.short_description?.replace(/<[^>]+>/g, "").trim();

  return (
    <Link href={`/product/${product.slug}`} className="group flex flex-col border border-line bg-surface">
      <div className="relative aspect-[16/13] overflow-hidden border-b border-line bg-ink-2">
        {img ? (
          <Image
            src={img.src}
            alt={img.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-5"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-data text-xs text-muted-2">NO IMAGE</div>
        )}
        <span className="absolute left-3 top-3 font-data text-[10px] uppercase tracking-wide text-muted-2">
          {product.sku}
        </span>
        <span
          className={`absolute right-3 top-3 font-data text-[10px] uppercase tracking-wide ${
            inStock ? "text-accent" : "text-muted-2"
          }`}
        >
          {inStock ? "In stock" : "Backorder"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-serif-display text-[1.375rem] leading-tight text-fg">{product.name}</h3>
        {descriptor && <p className="line-clamp-1 text-[13px] text-muted">{descriptor}</p>}
        {rating && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <SquareStars rating={rating.rating} />
            <span className="font-data text-[11px] text-muted-2">
              {rating.rating.toFixed(1)} ({rating.count})
            </span>
          </div>
        )}
        <div className="mt-auto pt-3">
          {perVialLabel ? (
            <p className="font-data text-[13px] text-fg">
              FROM <span className="text-accent">{perVialLabel.replace(/^from\s*/i, "")}</span>
            </p>
          ) : (
            <p className="font-data text-[13px] text-fg">
              {formatMinor(product.prices.price, product.prices)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-muted-2 underline decoration-line-2 underline-offset-2 group-hover:text-accent group-hover:decoration-accent">
            View pack options
          </p>
        </div>
      </div>
    </Link>
  );
}
