import { FREE_SHIPPING_THRESHOLD } from "@/lib/env";

/**
 * Thin site-wide trust strip above the header. Repeats the four things a
 * research buyer cares about most before they'll trust a peptide vendor:
 * independent purity guarantee, free-shipping threshold, dispatch speed, and
 * discreet delivery. Static and server-rendered.
 */
const ITEMS = [
  "🛡️ 98%+ purity guaranteed — or refund/replace",
  `🚚 Free shipping over $${FREE_SHIPPING_THRESHOLD}`,
  "⚡ 1-business-day dispatch from AU",
  "🤐 Discreet packaging & billing",
];

export default function AnnouncementBar() {
  return (
    <div className="border-b border-line bg-surface-2 text-fg-2">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-center text-[11px] font-medium sm:text-xs">
        {ITEMS.map((item, i) => (
          <span
            key={item}
            className={i === 0 ? "" : i === 1 ? "hidden sm:inline" : "hidden lg:inline"}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
