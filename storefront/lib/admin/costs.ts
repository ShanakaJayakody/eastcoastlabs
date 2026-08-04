/**
 * Cost & margin. Admin-only — nothing here is ever exposed to shoppers.
 *
 * Costs mirror the stock model: one figure per product, per VIAL. A pack tier's
 * cost is `unit_cost_cents × pack_size`, exactly as its stock is vials ÷ pack.
 *
 * Two invariants worth preserving:
 *   1. Purchase prices are recorded on the receipt movement, so the ledger is
 *      also the buying history.
 *   2. Sales snapshot their COGS at payment. Historical profit must never move
 *      when a supplier changes their price next month.
 */
import { adminDb } from "./db";

export interface Margin {
  costCents: number | null;
  marginCents: number | null;
  marginPct: number | null;
}

/** Margin for one sold unit at a given price and cost. */
export function marginOf(priceCents: number, costCents: number | null | undefined): Margin {
  if (costCents == null) return { costCents: null, marginCents: null, marginPct: null };
  const marginCents = priceCents - costCents;
  return {
    costCents,
    marginCents,
    marginPct: priceCents > 0 ? Math.round((marginCents / priceCents) * 1000) / 10 : null,
  };
}

/** Cost of one pack tier = vial cost × pack size. */
export function tierCostCents(unitCostCents: number | null, packSize: number): number | null {
  if (unitCostCents == null) return null;
  return unitCostCents * Math.max(1, packSize);
}

/**
 * Record a costed receipt: update the weighted average via the DB function.
 * Called after the stock movement is appended, so `on_hand` already includes
 * the received vials (the SQL subtracts them to find the prior level).
 */
export async function applyReceiptCost(opts: {
  productId: string;
  receivedVials: number;
  paidCostCents: number;
}): Promise<number | null> {
  const { data, error } = await adminDb().rpc("recompute_unit_cost", {
    p_product: opts.productId,
    p_received_vials: opts.receivedVials,
    p_paid_cost_cents: opts.paidCostCents,
  });
  if (error) throw new Error(`applyReceiptCost: ${error.message}`);
  return typeof data === "number" ? data : null;
}

/** Stamp the purchase price onto the receipt movement (the buying history). */
export async function tagMovementCost(opts: {
  variantId: string;
  unitCostCents: number;
}): Promise<void> {
  const db = adminDb();
  const { data } = await db
    .from("stock_movements")
    .select("id")
    .eq("variant_id", opts.variantId)
    .eq("reason", "received")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return;
  await db
    .from("stock_movements")
    .update({ unit_cost_cents: opts.unitCostCents })
    .eq("id", data.id);
}

/** Directly set a product's vial cost (manual override, no receipt involved). */
export async function setUnitCost(productId: string, unitCostCents: number | null): Promise<void> {
  const { error } = await adminDb()
    .from("products")
    .update({ unit_cost_cents: unitCostCents, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw new Error(`setUnitCost: ${error.message}`);
}

/**
 * Freeze COGS onto each line of an order. Cost is per unit sold — i.e. the vial
 * cost × the line's pack size — so a 3-pack line carries three vials of cost.
 * Idempotent: lines that already hold a snapshot are left alone.
 */
export async function snapshotOrderCosts(orderId: string): Promise<void> {
  const db = adminDb();
  const { data: items } = await db
    .from("order_items")
    .select("id, variant_id, unit_cost_cents")
    .eq("order_id", orderId);
  if (!items?.length) return;

  const pending = items.filter((i) => i.unit_cost_cents == null && i.variant_id);
  if (!pending.length) return;

  const { data: variants } = await db
    .from("product_variants")
    .select("id, pack_size, products!inner(unit_cost_cents)")
    .in("id", pending.map((i) => i.variant_id as string));

  const costByVariant = new Map<string, number | null>();
  for (const v of (variants ?? []) as unknown as {
    id: string;
    pack_size: number;
    products: { unit_cost_cents: number | null };
  }[]) {
    costByVariant.set(v.id, tierCostCents(v.products?.unit_cost_cents ?? null, v.pack_size));
  }

  for (const item of pending) {
    const cost = costByVariant.get(item.variant_id as string);
    if (cost == null) continue; // no cost known yet — leave null rather than guess
    await db.from("order_items").update({ unit_cost_cents: cost }).eq("id", item.id);
  }
}

export interface ProfitSummary {
  revenueCents: number;
  cogsCents: number;
  profitCents: number;
  marginPct: number | null;
  /** Lines still missing a cost — profit is understated until they're costed. */
  uncostedLines: number;
}

/** Revenue − COGS for a set of orders, net of refunded quantities. */
export async function profitForOrders(orderIds: string[]): Promise<ProfitSummary> {
  const empty = { revenueCents: 0, cogsCents: 0, profitCents: 0, marginPct: null, uncostedLines: 0 };
  if (!orderIds.length) return empty;

  const { data } = await adminDb()
    .from("order_items")
    .select("qty, refunded_qty, unit_price_cents, unit_cost_cents, line_total_cents, refunded_cents")
    .in("order_id", orderIds);
  if (!data?.length) return empty;

  let revenueCents = 0;
  let cogsCents = 0;
  let uncostedLines = 0;

  for (const r of data) {
    const netQty = Math.max(0, (r.qty as number) - ((r.refunded_qty as number) ?? 0));
    revenueCents += (r.line_total_cents as number) - (((r.refunded_cents as number) ?? 0));
    if (r.unit_cost_cents == null) {
      if (netQty > 0) uncostedLines += 1;
      continue;
    }
    cogsCents += (r.unit_cost_cents as number) * netQty;
  }

  const profitCents = revenueCents - cogsCents;
  return {
    revenueCents,
    cogsCents,
    profitCents,
    marginPct: revenueCents > 0 ? Math.round((profitCents / revenueCents) * 1000) / 10 : null,
    uncostedLines,
  };
}

/** Profit across a rolling window of paid orders — dashboard tiles. */
export async function profitSince(days: number | null): Promise<ProfitSummary> {
  const db = adminDb();
  let q = db.from("orders").select("id").in("status", ["paid", "processing", "shipped", "completed"]);
  if (days != null) {
    const since = new Date();
    if (days === 0) since.setHours(0, 0, 0, 0);
    else since.setDate(since.getDate() - days);
    q = q.gte("created_at", since.toISOString());
  }
  const { data } = await q;
  return profitForOrders((data ?? []).map((o) => o.id as string));
}
