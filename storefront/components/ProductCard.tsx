import Link from "next/link";
import Image from "next/image";
import type { WooProduct } from "@/lib/woo";
import { minorToMajor, formatMinor } from "@/lib/format";
import { fromPerVialLabel } from "@/lib/pricing";
import { getAggregate } from "@/lib/reviews";
import Stars from "./Stars";

/** The subset of a product a card needs — lets callers pass slim objects. */
export type CardProduct = Pick<
  WooProduct,
  "id" | "name" | "slug" | "sku" | "is_in_stock" | "images" | "prices"
>;

export default function ProductCard({ product }: { product: CardProduct }) {
  const img = product.images?.[0];
  const single = minorToMajor(product.prices.price, product.prices.currency_minor_unit);
  const perVialLabel = fromPerVialLabel(product.slug, product.name, single);
  const inStock = product.is_in_stock !== false;
  const rating = getAggregate(product.slug);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="card-hover group flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-accent/50"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-2">
        {img ? (
          <Image
            src={img.src}
            alt={img.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl text-muted-2">🧪</div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            inStock ? "bg-success/15 text-success" : "bg-warn/15 text-warn"
          }`}
        >
          {inStock ? "In stock" : "Out of stock"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-semibold text-fg">{product.name}</h3>
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
          {perVialLabel ? (
            <p className="text-sm font-semibold text-accent">{perVialLabel}</p>
          ) : (
            <p className="text-sm font-semibold text-fg">
              {formatMinor(product.prices.price, product.prices)}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-2 group-hover:text-fg-2">View pack options →</p>
        </div>
      </div>
    </Link>
  );
}
