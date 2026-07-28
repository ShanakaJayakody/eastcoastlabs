import type { FaqItem } from "@/components/Faq";

/**
 * Editorial FAQ — a definition list on desktop (answers always visible;
 * hiding them would hide trust on a proof-led page), native <details> on
 * mobile to save scroll length.
 */
export default function DossierFaq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      {/* Desktop: two-column definition list, always expanded */}
      <dl className="hidden divide-y divide-line border-t border-line sm:block">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-2 gap-8 py-6">
            <dt className="font-serif-display text-lg text-fg">{item.q}</dt>
            <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>

      {/* Mobile: native disclosure, no custom JS */}
      <div className="divide-y divide-line border-t border-line sm:hidden">
        {items.map((item, i) => (
          <details key={i} className="group py-4">
            <summary className="font-serif-display flex cursor-pointer list-none items-center justify-between text-base text-fg">
              {item.q}
              <span className="font-data ml-3 text-muted-2 group-open:hidden">+</span>
              <span className="font-data ml-3 hidden text-muted-2 group-open:inline">−</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
