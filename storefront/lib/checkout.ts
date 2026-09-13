/**
 * Server-side cart resolution — the checkout trust boundary.
 *
 * The browser tells us WHAT it wants (product slug, pack size, quantity, whether
 * a gift is claimed). It never tells us what anything COSTS: every price is
 * re-derived here from active product_variants, and gift eligibility is re-checked against the server's
 * own subtotal. A tampered cart therefore cannot change what the customer pays.
 *
 * SERVER ONLY — imports the service-role client.
 */
import { adminDb } from "./admin/db";
import { getAccessory, RECON_KIT_SLUG } from "./accessories";
import { getAvailability } from "./admin/inventory";
import { getSettings } from "./settings";
import { getStackBySlug } from "./stacks";
import { BAC_WATER_SLUG } from "./bumps";
import type { NewOrderItem, ExtraOrderItem } from "./admin/orders";
import { isGiftEligible } from "./cart-offers";


/** What the client is allowed to send us per line. Note: no prices. */
export interface ClientCartLine {
  key: string;
  slug: string;
  variantLabel: string;
  variantId?: string;
  quantity: number;
}

export interface ResolvedCartLine {
  key: string; slug: string; name: string; variantLabel: string; variantId?: string;
  quantity: number; unitPriceCents: number; lineTotalCents: number; isGift: boolean;
}

export interface ResolvedCart {
  lines: ResolvedCartLine[];
  items: NewOrderItem[];
  extraItems: ExtraOrderItem[];
  subtotalCents: number;
  giftApplied: boolean;
  warnings: string[];
}

/** Recheck the spend reward against the discounted goods total, retaining
 * contractual bundle inclusions. Only resolveCart creates this exact suffix. */
export function applyGiftThreshold(cart:ResolvedCart,qualifyingSubtotalCents:number,thresholdCents:number):ResolvedCart {
  if (!cart.giftApplied || isGiftEligible({subtotalCents:qualifyingSubtotalCents,thresholdCents,available:1,
    hasPaidItems:cart.lines.some(line=>!line.isGift && line.lineTotalCents>0)})) return cart;
  return {...cart,giftApplied:false,
    lines:cart.lines.filter(line=>!line.isGift),
    items:cart.items.filter(item=>item.labelSuffix!==' · Free gift'),
    warnings:[...cart.warnings,'Free gift removed — the discounted order no longer meets the threshold.'],
  };
}

/** Parse the pack size out of a cart label ("3-pack · Subscribe (…)" → 3). */
export function packSizeFromLabel(label: string): number {
  const l = label.toLowerCase();
  const m = l.match(/(\d+)\s*-?\s*pack/);
  if (m) return parseInt(m[1], 10);
  if (l.includes("vial")) return 1;
  return 1;
}

const isGiftKey = (key: string) => key.startsWith("gift:");
/** Stacks are bundles of several products added as ONE cart line (key
 *  "stack:<slug>"). They resolve to real, individually-stocked order items. */
const isStackKey = (key: string) => key.startsWith("stack:");

interface VariantLookup {
  id: string;
  price_cents: number;
  pack_size: number;
  slug: string;
  name: string;
  label: string;
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
    .filter((l) => l && typeof l.slug === "string" && typeof l.key === "string" && typeof l.variantLabel === "string")
    .filter(l => l.variantId === undefined || (!isStackKey(l.key) && !isGiftKey(l.key)))
    .map((l) => ({
      ...l,
      quantity: Math.min(99, Math.max(1, Math.floor(Number(l.quantity) || 1))),
    }));

  if (clean.length !== lines.length || clean.some((l, i) => l.quantity !== lines[i]?.quantity)) warnings.push("Cart quantities were adjusted; review your order.");
  const resolvedLines: ResolvedCartLine[] = [];
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
      .select("id, price_cents, pack_size, label, products!inner(slug, name)")
      .in("products.slug", slugs)
      .eq("active", true)
      .eq("products.status", "active");
    if (error) throw new Error(`resolveCart: ${error.message}`);
    variants = (data as unknown as Array<VariantLookup & { products: { slug: string; name: string } }>).map(
      (v) => ({ id: v.id, price_cents: v.price_cents, pack_size: v.pack_size, slug: v.products.slug, name: v.products.name, label: v.label }),
    );
  }
  const variantKey = (slug: string, pack: number) => `${slug}::${pack}`;
  const byKey = new Map(variants.map((v) => [variantKey(v.slug, v.pack_size), v]));

  const lookup = (line: ClientCartLine) => line.variantId !== undefined
    ? variants.find(v => v.id === line.variantId && v.slug === line.slug)
    : byKey.get(variantKey(line.slug, getAccessory(line.slug) ? 1 : packSizeFromLabel(line.variantLabel)));

  const items: NewOrderItem[] = [];
  const extraItems: ExtraOrderItem[] = [];

  // ---- Bacteriostatic-water dependency budget ---------------------------
  // Three things in a cart consume bac water beyond plain bac lines: the stack
  // "reconstitution pack" inclusion, the spend-threshold gift (both ship a REAL
  // $0 vial), and the Reconstitution Starter Kit (a paid unit with a bac vial
  // packed inside). All must be covered by real availability, computed AFTER
  // the paid bac water in this same cart — paid bac lines always win. When the
  // pool runs dry the dependent lines degrade with a warning instead of a $0
  // line failing reservation and killing an otherwise-payable order.
  const kitLines = paidLines.filter((l) => !isStackKey(l.key) && l.slug === RECON_KIT_SLUG);
  const wantsFreeBac =
    clean.some((l) => isGiftKey(l.key)) || resolvedStacks.some(({ stack }) => stack?.freeBacWater);
  let freeBacBudget = 0;
  let giftVariantId: string | null = null;
  let bacBudgetLoaded = false;
  // Kits fail closed when their required water variant cannot be resolved.
  let kitBacCovered = kitLines.length === 0;
  async function loadBacBudget() {
    if (bacBudgetLoaded) return;
    bacBudgetLoaded = true;
    const bacPoolId = byKey.get(variantKey(BAC_WATER_SLUG, 1))?.id ?? (await findGiftVariant());
    giftVariantId = bacPoolId;
    if (bacPoolId) {
      const paidBacVials = paidLines
        .filter((l) => !isStackKey(l.key) && l.slug === BAC_WATER_SLUG)
        .reduce((sum, l) => sum + (lookup(l)?.pack_size ?? 0) * l.quantity, 0);
      const avail = await getAvailability(bacPoolId);
      const net = Math.max(0, (avail?.available ?? 0) - paidBacVials);
      // Kits claim their vials first (they're paid), free bonuses get the rest.
      // If the kits can't be covered they get dropped below, so their vials
      // return to the free-bonus budget rather than being double-counted.
      const kitVials = kitLines.reduce((sum, l) => sum + l.quantity, 0);
      kitBacCovered = net >= kitVials;
      freeBacBudget = kitBacCovered ? net - kitVials : net;
    }
  }
  if (wantsFreeBac || kitLines.length) await loadBacBudget();

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

    const bundleCents = stack.bundlePriceCents;
    const componentsCents = componentVariants.map(({ variant }) => variant!.price_cents);
    const componentsTotal = componentsCents.reduce((a, b) => a + b, 0);

    resolvedLines.push({ key: line.key, slug: line.slug, name: stack.name, variantLabel: "Bundle", quantity: line.quantity, unitPriceCents: bundleCents, lineTotalCents: bundleCents * line.quantity, isGift: false });
    for (let unit = 0; unit < line.quantity; unit++) {
      let allocated = 0;
      componentVariants.forEach(({ variant }, i) => {
        const isLast = i === componentVariants.length - 1;
        const share = isLast
          ? bundleCents - allocated
          : componentsTotal === 0 ? 0 : Math.round((componentsCents[i] / componentsTotal) * bundleCents);
        allocated += share;
        items.push({
          variantId: variant!.id,
          expectedPriceCents: variant!.price_cents,
          qty: 1,
          priceOverrideCents: Math.max(0, share),
          labelSuffix: ` · ${stack.name}`,
        });
      });

      // Stacks that advertise free bacteriostatic water ship a real $0 vial —
      // it reserves and decrements stock exactly like a sold one, so it is
      // only added while the free-bac budget covers it.
      if (stack.freeBacWater) {
        const bac = byKey.get(variantKey(BAC_WATER_SLUG, 1));
        if (bac && freeBacBudget >= 1) {
          freeBacBudget -= 1;
          items.push({
            variantId: bac.id,
            qty: 1,
            priceOverrideCents: 0,
            labelSuffix: ` · ${stack.name} (included)`,
          });
        } else if (unit === 0) {
          warnings.push(
            `${stack.name}: the included free bacteriostatic water is out of stock and was left off this order.`,
          );
        }
      }
    }
  }

  for (const line of paidLines) {
    if (isStackKey(line.key)) continue; // handled above
    // The starter kit ships a bac-water vial inside it — it cannot be sold
    // when the bac pool can't cover the kits in this cart, no matter how many
    // kit boxes are on the shelf.
    if (line.slug === RECON_KIT_SLUG && !kitBacCovered) {
      warnings.push(
        "Removed Reconstitution Starter Kit — the bacteriostatic water it includes is out of stock.",
      );
      continue;
    }
    // Accessory labels describe contents ("100 pack" of swabs), not vial pack
    // tiers — an accessory unit is always ONE stock unit, so its variant lives
    // at pack_size 1. Parsing "100 pack" as a 100-vial tier would miss the
    // variant. Missing/retired accessory variants are unavailable.
    const variant = lookup(line);

    if (variant) {
      items.push({ variantId: variant.id, qty: line.quantity, expectedPriceCents: variant.price_cents });
      resolvedLines.push({ key: line.key, slug: line.slug, name: variant.name, variantLabel: variant.label, variantId:variant.id, quantity: line.quantity, unitPriceCents: variant.price_cents, lineTotalCents: variant.price_cents * line.quantity, isGift: false });
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

  // Derive the automatic reward from the SERVER's subtotal, even when a
  // restored/direct-checkout cart has never mounted the cart drawer. A forged
  // gift claim never grants eligibility. The gift is a real vial, so it resolves to a
  // stocked variant at $0 — it reserves and decrements inventory like any sale,
  // and is therefore only granted while the free-bac budget covers it.
  const { giftThreshold } = await getSettings();
  let giftApplied = false;
  const qualifies = isGiftEligible({subtotalCents,thresholdCents:Math.round(giftThreshold*100),available:1,
    hasPaidItems:resolvedLines.some(line=>!line.isGift && line.lineTotalCents>0)});
  if (qualifies) await loadBacBudget();
  if (giftClaimed || qualifies) {
    if (!qualifies) {
      warnings.push("Free gift removed — order no longer meets the threshold.");
    } else if (freeBacBudget < 1) {
      warnings.push("Free gift unavailable — bacteriostatic water is currently out of stock.");
    } else {
      const giftVariant = giftVariantId;
      if (giftVariant) {
        freeBacBudget -= 1;
        items.push({
          variantId: giftVariant,
          qty: 1,
          priceOverrideCents: 0,
          labelSuffix: " · Free gift",
        });
        giftApplied = true;
        resolvedLines.push({ key: 'gift:bac-water', slug: BAC_WATER_SLUG, name: "Bacteriostatic Water", variantLabel: "Free gift", quantity: 1, unitPriceCents: 0, lineTotalCents: 0, isGift: true });
      }
    }
  }

  return { lines: resolvedLines, items, extraItems, subtotalCents, giftApplied, warnings };
}

/** The 1-vial bacteriostatic-water variant used for the spend-threshold gift. */
async function findGiftVariant(): Promise<string | null> {
  const { data, error } = await adminDb()
    .from("product_variants")
    .select("id, products!inner(slug)")
    .eq("products.slug", "bacteriostatic-water")
    .eq("pack_size", 1)
    .eq("active", true)
    .eq("products.status", "active")
    .maybeSingle();
  if (error) throw new Error(`findGiftVariant: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}
