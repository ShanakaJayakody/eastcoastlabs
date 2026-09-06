/**
 * Stock ledger. on_hand is maintained by a DB trigger as the sum of movements —
 * this module only ever APPENDS movements or reserves/releases via the atomic
 * RPCs. Never write inventory.on_hand directly.
 *
 * ── Stock is counted in VIALS, once per product ──────────────────────────────
 * A "3-pack" is not a separate physical item; it is 3 vials picked at packing
 * time. So every product keeps ONE pool of vials — held on its pack_size = 1
 * variant — and the pack tiers derive their availability from it
 * (available packs = floor(vials ÷ pack_size)).
 *
 * Every write therefore translates through `toVials()`: a movement or
 * reservation of 2 × 3-pack becomes 6 vials against the pool. Doing this here,
 * at the single choke point every caller already uses, means no call site can
 * forget to multiply — which would silently oversell (selling 30 singles AND
 * 30 three-packs out of 30 physical vials).
 */
import { adminDb } from "./db";
import { logAudit } from "./audit";

export type MovementReason = "received" | "sale" | "return" | "adjustment" | "recount";

interface PoolRef {
  poolVariantId: string;
  packSize: number;
}

/**
 * Resolve a variant to its product's vial pool (the pack_size = 1 variant) and
 * its pack size. Falls back to the variant itself if a product somehow has no
 * 1-vial tier, so stock handling degrades to the old per-variant behaviour
 * rather than throwing mid-checkout.
 */
async function resolvePool(variantId: string): Promise<PoolRef> {
  const db = adminDb();
  const { data: variant } = await db
    .from("product_variants")
    .select("id, pack_size, product_id")
    .eq("id", variantId)
    .maybeSingle();

  if (!variant) return { poolVariantId: variantId, packSize: 1 };
  const packSize = Math.max(1, Number(variant.pack_size) || 1);
  if (packSize === 1) return { poolVariantId: variantId, packSize: 1 };

  const { data: pool } = await db
    .from("product_variants")
    .select("id")
    .eq("product_id", variant.product_id)
    .eq("pack_size", 1)
    .maybeSingle();

  return { poolVariantId: (pool?.id as string) ?? variantId, packSize };
}

/** Vial-equivalent of a pack quantity, plus the pool it applies to. */
async function toVials(variantId: string, qty: number): Promise<{ poolVariantId: string; vials: number; packSize: number }> {
  const { poolVariantId, packSize } = await resolvePool(variantId);
  return { poolVariantId, vials: qty * packSize, packSize };
}

/** Packs of a given size that a vial count can fill. */
export function packsAvailable(vialsAvailable: number, packSize: number): number {
  if (packSize <= 1) return Math.max(0, vialsAvailable);
  return Math.max(0, Math.floor(vialsAvailable / packSize));
}

export interface Availability {
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

/**
 * Append a signed movement to the ledger (the trigger updates on_hand).
 * `qty` is in PACKS of the given variant; it is stored against the product's
 * vial pool in vials, so `on_hand = sum(movements)` stays true for the pool.
 */
export async function recordMovement(opts: {
  variantId: string;
  qty: number;
  reason: MovementReason;
  actor?: string;
  orderId?: string;
  note?: string;
}): Promise<void> {
  const { poolVariantId, vials, packSize } = await toVials(opts.variantId, opts.qty);
  // Keep the pack context readable in the ledger, e.g. "2 × 3-pack".
  const note =
    packSize > 1
      ? [opts.note, `${opts.qty} × ${packSize}-pack = ${vials} vials`].filter(Boolean).join(" · ")
      : opts.note ?? null;

  const { error } = await adminDb().from("stock_movements").insert({
    variant_id: poolVariantId,
    qty: vials,
    reason: opts.reason,
    actor_email: opts.actor ?? null,
    order_id: opts.orderId ?? null,
    note,
  });
  if (error) throw new Error(`recordMovement: ${error.message}`);
}

/**
 * Atomically reserve `qty` packs — i.e. qty × pack_size vials from the product's
 * pool. Returns false if there aren't enough vials.
 */
export async function reserveStock(variantId: string, qty: number): Promise<boolean> {
  const { poolVariantId, vials } = await toVials(variantId, qty);
  const { data, error } = await adminDb().rpc("reserve_stock", {
    p_variant: poolVariantId,
    p_qty: vials,
  });
  if (error) throw new Error(`reserveStock: ${error.message}`);
  return Boolean(data);
}

/**
 * Free vials available for a would-be reservation, and whether it would fit.
 *
 * Lives here rather than in the caller because the pack-to-vial translation is
 * this module's business: asking a 6-pack row for its own availability reads
 * plausible and is wrong, since packs draw on the shared single-vial pool.
 */
export async function availabilityFor(
  variantId: string,
  qty: number,
): Promise<{ available: number; needed: number; sufficient: boolean }> {
  const { poolVariantId, vials } = await toVials(variantId, qty);
  const { data } = await adminDb()
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", poolVariantId)
    .maybeSingle();
  const row = data as { on_hand: number; reserved: number } | null;
  const available = row ? row.on_hand - row.reserved : 0;
  return { available, needed: vials, sufficient: available >= vials };
}

/** Release a prior reservation (cancel, or on conversion to a sale). */
export async function releaseStock(variantId: string, qty: number): Promise<void> {
  const { poolVariantId, vials } = await toVials(variantId, qty);
  const { error } = await adminDb().rpc("release_stock", {
    p_variant: poolVariantId,
    p_qty: vials,
  });
  if (error) throw new Error(`releaseStock: ${error.message}`);
}

/** Admin-facing stock change with a mandatory reason. Writes a movement + audit. */
export async function adjustStock(opts: {
  variantId: string;
  qty: number;
  reason: MovementReason;
  actor: string;
  note?: string;
}): Promise<void> {
  await recordMovement(opts);
  await logAudit({
    actor: opts.actor,
    action: "stock.adjust",
    entityType: "product_variant",
    entityId: opts.variantId,
    diff: { qty: opts.qty, reason: opts.reason, note: opts.note ?? null },
  });
}

export async function getAvailability(variantId: string): Promise<Availability | null> {
  const { data, error } = await adminDb()
    .from("inventory")
    .select("on_hand, reserved, low_stock_threshold")
    .eq("variant_id", variantId)
    .maybeSingle();
  if (error) throw new Error(`getAvailability: ${error.message}`);
  if (!data) return null;
  return {
    onHand: data.on_hand,
    reserved: data.reserved,
    available: data.on_hand - data.reserved,
    lowStockThreshold: data.low_stock_threshold,
  };
}
