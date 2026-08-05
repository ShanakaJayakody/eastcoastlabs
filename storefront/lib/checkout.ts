/**
 * Server-side cart resolution — the checkout trust boundary.
 *
 * The browser tells us WHAT it wants (product slug, pack size, quantity, whether
 * a line is a subscription, whether a gift is claimed). It never tells us what
 * anything COSTS: every price is re-derived here from product_variants or
 * data/accessories.json, and gift eligibility is re-checked against the server's
 * own subtotal. A tampered cart therefore cannot change what the customer pays.
 *
 * SERVER ONLY — imports the service-role client.
 */
import { adminDb } from "./admin/db";
import { getAccessory } from "./accessories";
import { getSettings } from "./settings";
import { getStackBySlug } from "./stacks";
import type { NewOrderItem, ExtraOrderItem } from "./admin/orders";

/** Subscribe-and-save rate, mirrored from the storefront BuyBox. */
export const SUBSCRIBE_DISCOUNT_PCT = 10;

/** What the client is allowed to send us per line. Note: no prices. */
export interface ClientCartLine {
  key: string;
  slug: string;
  variantLabel: string;
  quantity: number;
}

export interface ResolvedCart {
  items: NewOrderItem[];
  extraItems: ExtraOrderItem[];
  subtotalCents: number;
  giftApplied: boolean;
  warnings: string[];
}

/** Parse the pack size out of a cart label ("3-pack · Subscribe (…)" → 3). */
export function packSizeFromLabel(label: string): number {
  const l = label.toLowerCase();
  const m = l.match(/(\d+)\s*-?\s*pack/);
  if (m) return parseInt(m[1], 10);
  if (l.includes("vial")) return 1;
  return 1;
}

const isSubscription = (label: string) => /subscribe/i.test(label);
const isGiftKey = (key: string) => key.startsWith("gift:");
/** Stacks are bundles of several products added as ONE cart line (key
 *  "stack:<slug>"). They resolve to real, individually-stocked order items. */
const isStackKey = (key: string) => key.startsWith("stack:");

interface VariantLookup {
  id: string;
  price_cents: number;
  pack_size: number;
  slug: string;
}

/**
 * Resolve client cart lines into server-priced order items.
 *
 * Two passes are required: the first prices everything real, because gift
 * eligibility depends on the server's own subtotal — not on any client claim.
 */
export async function resolveCart(lines: ClientCartLine[]): Promise<ResolvedCart> {
  const warnings: string[] = [];
  const clean = lines
    .filter((l) => l && typeof l.slug === "string")
    .map((l) => ({
      ...l,
      quantity: Math.min(99, Math.max(1, Math.floor(Number(l.quantity) || 1))),
    }));

  const paidLines = clean.filter((l) => !isGiftKey(l.key));
  const giftClaimed = clean.some((l) => isGiftKey(l.key));

  // Stacks are bundle lines: one cart row that stands for several real products.
  // They must be expanded BEFORE the variant query so their components are
  // included in it — otherwise a stack matches no variant and no accessory, and
  // gets silently dropped as an unrecognised item.
  const stackLines = paidLines.filter((l) => isStackKey(l.key));
  const resolvedStacks = await Promise.all(
    stackLines.map(async (line) => ({ line, stack: await getStackBySlug(line.slug) })),
  );

  // Look up every catalog variant referenced by the cart, in one query —
  // including the single-vial variant behind each stack component.
  const slugs = [
    ...new Set([
      ...paidLines.filter((l) => !isStackKey(l.key)).map((l) => l.slug),
      ...resolvedStacks.flatMap(({ stack }) => stack?.components.map((c) => c.slug) ?? []),
      // A stack that includes free bacteriostatic water needs that variant too.
      ...(resolvedStacks.some(({ stack }) => stack?.freeBacWater) ? ["bacteriostatic-water"] : []),
    ]),
  ];
  let variants: VariantLookup[] = [];
  if (slugs.length) {
    const { data, error } = await adminDb()
      .from("product_variants")
      .select("id, price_cents, pack_size, products!inner(slug)")
      .in("products.slug", slugs)
      .eq("active", true);
    if (error) throw new Error(`resolveCart: ${error.message}`);
    variants = (data as unknown as Array<VariantLookup & { products: { slug: string } }>).map(
      (v) => ({ id: v.id, price_cents: v.price_cents, pack_size: v.pack_size, slug: v.products.slug }),
    );
  }
  const variantKey = (slug: string, pack: number) => `${slug}::${pack}`;
  const byKey = new Map(variants.map((v) => [variantKey(v.slug, v.pack_size), v]));

  const items: NewOrderItem[] = [];
  const extraItems: ExtraOrderItem[] = [];

  // ---- Stack (bundle) lines --------------------------------------------
  // A stack is priced as a set: bundlePrice is below the sum of its parts. To
  // keep every component a real, stocked order item while still charging
  // exactly the bundle price, the discount is distributed across components
  // proportionally and the rounding remainder lands on the last one — so the
  // line totals always add up to the advertised price to the cent.
  for (const { line, stack } of resolvedStacks) {
    if (!stack) {
      warnings.push(`Removed unavailable bundle "${line.slug}".`);
      continue;
    }

    const componentVariants = stack.components.map((c) => ({
      component: c,
      variant: byKey.get(variantKey(c.slug, 1)),
    }));
    const missing = componentVariants.filter((c) => !c.variant);
    if (missing.length) {
      warnings.push(`Removed "${stack.name}" — ${missing[0].component.name} is unavailable.`);
      continue;
    }

    const bundleCents = Math.round(stack.bundlePrice * 100);
    const componentsCents = componentVariants.map(({ variant }) => variant!.price_cents);
    const componentsTotal = componentsCents.reduce((a, b) => a + b, 0);

    for (let unit = 0; unit < line.quantity; unit++) {
      let allocated = 0;
      componentVariants.forEach(({ variant }, i) => {
        const isLast = i === componentVariants.length - 1;
        const share = isLast
          ? bundleCents - allocated
          : Math.round((componentsCents[i] / componentsTotal) * bundleCents);
        allocated += share;
        items.push({
          variantId: variant!.id,
          qty: 1,
          priceOverrideCents: Math.max(0, share),
          labelSuffix: ` · ${stack.name}`,
        });
      });

      // Stacks that advertise free bacteriostatic water ship a real $0 vial —
      // it reserves and decrements stock exactly like a sold one.
      if (stack.freeBacWater) {
        const bac = byKey.get(variantKey("bacteriostatic-water", 1));
        if (bac) {
          items.push({
            variantId: bac.id,
            qty: 1,
            priceOverrideCents: 0,
            labelSuffix: ` · ${stack.name} (included)`,
          });
        }
      }
    }
  }

  for (const line of paidLines) {
    if (isStackKey(line.key)) continue; // handled above
    const pack = packSizeFromLabel(line.variantLabel);
    const variant = byKey.get(variantKey(line.slug, pack));

    if (variant) {
      const sub = isSubscription(line.variantLabel);
      items.push({
        variantId: variant.id,
        qty: line.quantity,
        discountPct: sub ? SUBSCRIBE_DISCOUNT_PCT : 0,
        labelSuffix: sub ? " · Subscribe" : "",
      });
      continue;
    }

    // Not a catalog product — is it a known accessory? (server-side price)
    const accessory = getAccessory(line.slug);
    if (accessory) {
      extraItems.push({
        name: accessory.name,
        slug: accessory.slug,
        label: accessory.unit,
        unitPriceCents: Math.round(accessory.price * 100),
        qty: line.quantity,
      });
      continue;
    }

    warnings.push(`Removed unrecognised item "${line.slug}".`);
  }

  // Server-computed subtotal of everything that is genuinely payable.
  // A priceOverrideCents line (stack component, $0 gift) is worth exactly its
  // override — reading the variant's list price here would charge bundle buyers
  // full freight and inflate the gift threshold.
  const subtotalCents =
    items.reduce((sum, i) => {
      if (typeof i.priceOverrideCents === "number") return sum + i.priceOverrideCents * i.qty;
      const v = variants.find((x) => x.id === i.variantId)!;
      const pct = i.discountPct ?? 0;
      return sum + Math.round(v.price_cents * (1 - pct / 100)) * i.qty;
    }, 0) + extraItems.reduce((sum, e) => sum + e.unitPriceCents * e.qty, 0);

  // Gift: only if the SERVER's subtotal clears the threshold. A forged gift line
  // on a small cart is dropped here. The gift is a real vial, so it resolves to a
  // stocked variant at $0 — it reserves and decrements inventory like any sale.
  const { giftThreshold } = await getSettings();
  let giftApplied = false;
  if (giftClaimed) {
    if (subtotalCents >= giftThreshold * 100) {
      const giftVariant = await findGiftVariant();
      if (giftVariant) {
        items.push({
          variantId: giftVariant,
          qty: 1,
          priceOverrideCents: 0,
          labelSuffix: " · Free gift",
        });
        giftApplied = true;
      }
    } else {
      warnings.push("Free gift removed — order no longer meets the threshold.");
    }
  }

  return { items, extraItems, subtotalCents, giftApplied, warnings };
}

/** The 1-vial bacteriostatic-water variant used for the spend-threshold gift. */
async function findGiftVariant(): Promise<string | null> {
  const { data } = await adminDb()
    .from("product_variants")
    .select("id, products!inner(slug)")
    .eq("products.slug", "bacteriostatic-water")
    .eq("pack_size", 1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
