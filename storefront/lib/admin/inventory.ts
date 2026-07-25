/**
 * Stock ledger. on_hand is maintained by a DB trigger as the sum of movements —
 * this module only ever APPENDS movements or reserves/releases via the atomic
 * RPCs. Never write inventory.on_hand directly.
 */
import { adminDb } from "./db";
import { logAudit } from "./audit";

export type MovementReason = "received" | "sale" | "return" | "adjustment" | "recount";

export interface Availability {
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

/** Append a signed movement to the ledger (the trigger updates on_hand). */
export async function recordMovement(opts: {
  variantId: string;
  qty: number;
  reason: MovementReason;
  actor?: string;
  orderId?: string;
  note?: string;
}): Promise<void> {
  const { error } = await adminDb().from("stock_movements").insert({
    variant_id: opts.variantId,
    qty: opts.qty,
    reason: opts.reason,
    actor_email: opts.actor ?? null,
    order_id: opts.orderId ?? null,
    note: opts.note ?? null,
  });
  if (error) throw new Error(`recordMovement: ${error.message}`);
}

/** Atomically reserve qty. Returns false if availability is insufficient. */
export async function reserveStock(variantId: string, qty: number): Promise<boolean> {
  const { data, error } = await adminDb().rpc("reserve_stock", {
    p_variant: variantId,
    p_qty: qty,
  });
  if (error) throw new Error(`reserveStock: ${error.message}`);
  return Boolean(data);
}

/** Release a prior reservation (cancel, or on conversion to a sale). */
export async function releaseStock(variantId: string, qty: number): Promise<void> {
  const { error } = await adminDb().rpc("release_stock", { p_variant: variantId, p_qty: qty });
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
