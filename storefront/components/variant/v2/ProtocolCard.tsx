"use client";

import Image from "next/image";
import type { ResolvedStack } from "@/lib/stacks";
import { formatAud, formatAudWhole } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { trackAddToCart } from "@/lib/analytics";

/**
 * Research stack restyled as a filed document: tab-top label, manifest table
 * of components, combined specimen viewport. Same cart-wiring as the control
 * site's StackCard — only the presentation differs.
 */
export default function ProtocolCard({ stack, index }: { stack: ResolvedStack; index: number }) {
  const { addLine } = useCart();
  const { openCart } = useUI();

  function handleAdd() {
    const variantLabel = `Stack · ${stack.components.map((c) => c.name).join(" + ")}`;
    addLine(
      {
        key: `stack:${stack.slug}`,
        productId: Number(`9${stack.slug.length}${stack.components.length}`),
        name: stack.name,
        slug: stack.slug,
        variantLabel,
        image: stack.components[0]?.image,
        unitPrice: stack.bundlePrice,
      },
      1,
    );
    trackAddToCart(
      { item_id: stack.slug, item_name: stack.name, item_variant: "stack", price: stack.bundlePrice, quantity: 1 },
      stack.bundlePrice,
    );
    openCart();
  }

  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <span className="font-data text-[11px] uppercase tracking-[0.1em] text-muted-2">
          Protocol {String(index).padStart(2, "0")} — {stack.tagline}
        </span>
        {stack.badge && (
          <span className="font-data text-[11px] uppercase tracking-wide text-accent-2">{stack.badge}</span>
        )}
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-[140px_1fr] sm:p-6">
        <div className="relative flex aspect-square items-center justify-center gap-1 border border-line bg-ink-2">
          {stack.components.map((c, i) => (
            <div key={c.slug} className="relative h-full w-full">
              {c.image ? (
                <Image src={c.image} alt={c.name} fill sizes="140px" className="object-contain p-3" />
              ) : null}
              {i < stack.components.length - 1 && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 font-data text-lg text-muted-2">+</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          <h3 className="font-serif-display text-xl text-fg">{stack.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{stack.blurb}</p>

          <table className="mt-4 w-full border-t border-line font-data text-[13px]">
            <tbody>
              {stack.components.map((c) => (
                <tr key={c.slug} className="border-b border-line">
                  <td className="py-1.5 text-fg-2">{c.name}</td>
                  <td className="py-1.5 text-right text-muted-2">{formatAud(c.singleVial)}</td>
                </tr>
              ))}
              {stack.freeBacWater && (
                <tr>
                  <td className="py-1.5 text-accent" colSpan={2}>
                    + Bacteriostatic water included free
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-end justify-between">
            <div className="font-data">
              <span className="text-2xl text-fg">{formatAudWhole(stack.bundlePrice)}</span>
              <span className="ml-2 text-sm text-muted-2 line-through">{formatAud(stack.componentsTotal)}</span>
              <p className="mt-0.5 text-[12px] text-accent-2">Save {formatAudWhole(stack.savings)}</p>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="border border-fg bg-fg px-5 py-2.5 font-data text-[13px] font-medium text-ink transition hover:opacity-85"
            >
              Add protocol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
