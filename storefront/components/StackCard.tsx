"use client";

import Image from "next/image";
import type { ResolvedStack } from "@/lib/stacks";
import { formatAud, formatAudWhole } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { trackAddToCart } from "@/lib/analytics";

export default function StackCard({ stack }: { stack: ResolvedStack }) {
  const { addLine } = useCart();
  const { openCart } = useUI();

  function handleAdd() {
    const variantLabel = `Stack · ${stack.components.map((c) => c.name).join(" + ")}`;
    addLine(
      {
        key: `stack:${stack.slug}`,
        productId: Number(`9${stack.slug.length}${stack.components.length}`), // synthetic id for the bundle line
        name: stack.name,
        slug: stack.slug,
        variantLabel,
        image: stack.components[0]?.image,
        unitPrice: stack.bundlePrice,
      },
      1,
    );
    trackAddToCart(
      {
        item_id: stack.slug,
        item_name: stack.name,
        item_variant: "stack",
        price: stack.bundlePrice,
        quantity: 1,
      },
      stack.bundlePrice,
    );
    openCart();
  }

  return (
    <div className="card-hover flex flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-accent/40">
      {/* Component images */}
      <div className="relative flex items-center justify-center gap-2 border-b border-line bg-ink-2 px-6 pb-6 pt-16">
        {stack.badge && (
          <span className="absolute left-4 top-4 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">
            {stack.badge}
          </span>
        )}
        <span className="absolute right-4 top-4 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
          Save {stack.discountPct}%
        </span>
        {stack.components.map((c, i) => (
          <div key={c.slug} className="flex items-center">
            {i > 0 && <span className="mx-1 text-2xl font-light text-muted-2">+</span>}
            <div className="relative h-28 w-24 shrink-0">
              {c.image ? (
                <Image src={c.image} alt={c.name} fill sizes="120px" className="object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl">🧪</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-fg">{stack.name}</h3>
        <p className="mt-1 text-xs font-medium text-accent">{stack.tagline}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{stack.blurb}</p>

        <ul className="mt-3 space-y-1 text-xs text-fg-2">
          {stack.components.map((c) => (
            <li key={c.slug} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-accent">✓</span>
                {c.name}
              </span>
              <span className="text-muted-2">{formatAud(c.singleVial)}</span>
            </li>
          ))}
          {stack.freeBacWater && (
            <li className="flex items-center gap-1.5 text-success">
              <span>✓</span> Bacteriostatic water included free
            </li>
          )}
        </ul>

        {/* Price */}
        <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-fg">{formatAudWhole(stack.bundlePrice)}</span>
              <span className="text-sm text-muted-2 line-through">{formatAud(stack.componentsTotal)}</span>
            </div>
            <span className="text-xs font-semibold text-success">
              Save {formatAudWhole(stack.savings)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="btn-press mt-4 w-full rounded-xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-ink transition hover:brightness-95"
        >
          Add stack to cart · {formatAudWhole(stack.bundlePrice)}
        </button>
      </div>
    </div>
  );
}
