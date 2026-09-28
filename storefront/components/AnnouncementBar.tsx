import { getSettings } from "@/lib/settings";
import { shippingAnnouncement, shippingRules } from '@/lib/shipping-policy';

/**
 * Thin site-wide trust strip above the header. Repeats the four things a
 * research buyer cares about most before they'll trust a peptide vendor:
 * independent purity guarantee, free-shipping threshold, dispatch speed, and
 * discreet delivery. Static and server-rendered.
 */
export default async function AnnouncementBar() {
  const settings = await getSettings();
  // Shipping promises are derived from checkout rules, never stale campaign text.
  const items = settings.announcementItems.filter(item => !/shipping|free\s+(?:standard|express)|\bexpress\b/i.test(item));
  const ITEMS = [items[0], shippingAnnouncement(shippingRules(settings)), ...items.slice(1)].filter(Boolean);
  return (
    <div className="ecl-announcement border-b border-line bg-surface-2 text-fg-2">
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
