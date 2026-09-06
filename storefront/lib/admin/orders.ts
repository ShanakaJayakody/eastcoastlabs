/**
 * Order lifecycle + the stock handshake.
 *
 * State machine (enforced server-side; illegal jumps throw):
 *   pending  → paid | cancelled
 *   paid     → processing | shipped | refunded | cancelled
 *   processing → shipped | refunded
 *   shipped  → completed | refunded
 *   completed → refunded
 *
 * Stock is RESERVED on create, SETTLED (on_hand decremented via a 'sale' movement)
 * on payment, and RESTORED (a 'return' movement) on refund. Each step is guarded
 * by an idempotency flag on the order so it can never double-fire.
 */
import { adminDb } from "./db";
import { logAudit } from "./audit";
import {
  recordMovement,
  reserveStock,
  releaseStock,
  resolvePoolsFor,
  poolAvailability,
} from "./inventory";
import { snapshotOrderCosts } from "./costs";
import { validateDiscount, incrementDiscountUsage } from "./discounts";
import { getSettings } from "@/lib/settings";
import { shippingCentsFor, isShippingMethod } from "@/lib/shipping";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "shipped", "refunded", "cancelled"],
  processing: ["shipped", "refunded"],
  shipped: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Standard-method shipping for a given discounted subtotal, from settings. */
async function standardShippingCentsFor(afterDiscountCents: number): Promise<number> {
  return shippingCentsFor(afterDiscountCents, "standard", await getSettings()).cents;
}

export interface NewOrderItem {
  variantId: string;
  qty: number;
  /** Server-derived per-line discount (e.g. subscribe-and-save). 0-100. */
  discountPct?: number;
  /** Server-derived price override in cents (e.g. a $0 gift vial). */
  priceOverrideCents?: number;
  /** Appended to the stored variant label (e.g. " · Subscribe"). */
  labelSuffix?: string;
}

/**
 * A non-stocked line (research accessories). Prices MUST already be resolved
 * server-side — never pass a client-supplied amount here.
 */
export interface ExtraOrderItem {
  name: string;
  slug: string;
  label: string;
  unitPriceCents: number;
  qty: number;
  sku?: string;
}

export interface CreateOrderInput {
  email: string;
  name?: string;
  shippingAddress?: Record<string, unknown>;
  items: NewOrderItem[];
  extraItems?: ExtraOrderItem[];
  discountCode?: string;
  shippingCents?: number;
  paymentMethod?: string;
  actor?: string;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  totalCents: number;
}

interface VariantRow {
  id: string;
  price_cents: number;
  label: string;
  sku: string;
  products: { slug: string; name: string } | null;
}

async function addEvent(
  orderId: string,
  type: "created" | "status" | "note" | "email" | "payment" | "stock" | "refund" | "edit",
  opts: { from?: OrderStatus; to?: OrderStatus; message?: string; actor?: string } = {},
): Promise<void> {
  await adminDb().from("order_events").insert({
    order_id: orderId,
    type,
    from_status: opts.from ?? null,
    to_status: opts.to ?? null,
    message: opts.message ?? null,
    actor_email: opts.actor ?? null,
  });
}

/**
 * Create a pending order and RESERVE its stock atomically. Totals are computed
 * server-side from variant prices — the caller's money values are never trusted.
 * Throws "OUT_OF_STOCK:<sku>" if any line can't be reserved.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const db = adminDb();
  const extras = input.extraItems ?? [];
  if (!input.items?.length && !extras.length) throw new Error("Order has no items.");

  const ids = input.items.map((i) => i.variantId);
  let variants: VariantRow[] = [];
  if (ids.length) {
    const { data, error: vErr } = await db
      .from("product_variants")
      .select("id, price_cents, label, sku, products(slug, name)")
      .in("id", ids);
    if (vErr) throw new Error(`createOrder: ${vErr.message}`);
    variants = data as unknown as VariantRow[];
  }

  const byId = new Map<string, VariantRow>(variants.map((v) => [v.id, v]));
  for (const i of input.items) {
    if (!byId.has(i.variantId)) throw new Error(`Unknown variant ${i.variantId}`);
    if (i.qty <= 0) throw new Error("Item qty must be positive.");
  }

  /** Server-authoritative unit price: DB price, minus any server-set discount. */
  const unitPriceFor = (i: NewOrderItem): number => {
    if (i.priceOverrideCents != null) return Math.max(0, Math.round(i.priceOverrideCents));
    const base = byId.get(i.variantId)!.price_cents;
    const pct = Math.min(100, Math.max(0, i.discountPct ?? 0));
    return Math.round(base * (1 - pct / 100));
  };

  // Reserve every line atomically; roll back reservations if any line fails.
  const reserved: NewOrderItem[] = [];
  try {
    for (const i of input.items) {
      const ok = await reserveStock(i.variantId, i.qty);
      if (!ok) throw new Error(`OUT_OF_STOCK:${byId.get(i.variantId)!.sku}`);
      reserved.push(i);
    }

    const subtotal =
      input.items.reduce((sum, i) => sum + unitPriceFor(i) * i.qty, 0) +
      extras.reduce((sum, e) => sum + Math.round(e.unitPriceCents) * e.qty, 0);

    let discountCents = 0;
    let discountCode: string | null = null;
    if (input.discountCode) {
      const d = await validateDiscount(input.discountCode, subtotal);
      if (d.ok) {
        discountCents = d.discountCents;
        discountCode = d.code ?? null;
      }
    }

    const afterDiscount = subtotal - discountCents;
    // Callers that already priced shipping (the storefront checkout, which also
    // picked the method) pass it in. Everything else — manual admin orders —
    // falls back to the configured standard rate.
    const shippingCents =
      input.shippingCents ?? (await standardShippingCentsFor(afterDiscount));
    const total = afterDiscount + shippingCents;

    const { data: order, error: oErr } = await db
      .from("orders")
      .insert({
        status: "pending",
        customer_email: input.email.trim().toLowerCase(),
        customer_name: input.name ?? null,
        shipping_address: input.shippingAddress ?? null,
        subtotal_cents: subtotal,
        discount_cents: discountCents,
        shipping_cents: shippingCents,
        total_cents: total,
        discount_code: discountCode,
        payment_method: input.paymentMethod ?? null,
        stock_reserved: true,
      })
      .select("id, order_number")
      .single();
    if (oErr) throw new Error(`createOrder insert: ${oErr.message}`);

    const items = [
      ...input.items.map((i) => {
        const v = byId.get(i.variantId)!;
        const unit = unitPriceFor(i);
        return {
          order_id: order.id,
          variant_id: v.id,
          product_slug: v.products?.slug ?? null,
          product_name: v.products?.name ?? null,
          variant_label: `${v.label}${i.labelSuffix ?? ""}`,
          sku: v.sku,
          unit_price_cents: unit,
          qty: i.qty,
          line_total_cents: unit * i.qty,
        };
      }),
      // Non-stocked accessory lines (no variant_id → no stock movement).
      ...extras.map((e) => ({
        order_id: order.id,
        variant_id: null,
        product_slug: e.slug,
        product_name: e.name,
        variant_label: e.label,
        sku: e.sku ?? null,
        unit_price_cents: Math.round(e.unitPriceCents),
        qty: e.qty,
        line_total_cents: Math.round(e.unitPriceCents) * e.qty,
      })),
    ];
    const { error: iErr } = await db.from("order_items").insert(items);
    if (iErr) throw new Error(`createOrder items: ${iErr.message}`);

    await addEvent(order.id, "created", {
      to: "pending",
      message: "Order created; stock reserved.",
      actor: input.actor,
    });
    await logAudit({
      actor: input.actor ?? input.email,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      diff: { total_cents: total, items: items.length },
    });

    return { orderId: order.id, orderNumber: order.order_number, totalCents: total };
  } catch (err) {
    // Roll back any reservations we already took.
    for (const r of reserved) await releaseStock(r.variantId, r.qty).catch(() => {});
    throw err;
  }
}

interface OrderRow {
  id: string;
  status: OrderStatus;
  discount_code: string | null;
  stock_reserved: boolean;
  stock_settled: boolean;
  stock_restored: boolean;
  refunded_cents: number;
  shipping_cents: number;
  total_cents: number;
}

async function loadOrder(orderId: string): Promise<OrderRow> {
  const { data, error } = await adminDb()
    .from("orders")
    .select(
      "id, status, discount_code, stock_reserved, stock_settled, stock_restored, refunded_cents, shipping_cents, total_cents",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`loadOrder: ${error.message}`);
  if (!data) throw new Error("Order not found.");
  return data as OrderRow;
}

async function orderItems(orderId: string): Promise<{ variant_id: string; qty: number }[]> {
  const { data, error } = await adminDb()
    .from("order_items")
    .select("variant_id, qty")
    .eq("order_id", orderId);
  if (error) throw new Error(`orderItems: ${error.message}`);
  return (data ?? []).filter((r) => r.variant_id) as { variant_id: string; qty: number }[];
}

/** Confirm payment: pending → paid, decrement stock (sale movements), release reservations. */
/**
 * Attach the payment reference and hold window to a freshly-created order.
 *
 * Split out of createOrder because the reference is derived from the order
 * NUMBER, which the database assigns on insert — it cannot be known before the
 * row exists. Called immediately after create, so a pending order is never
 * without one for longer than a round trip.
 */
export async function setOrderPaymentPlan(
  orderId: string,
  opts: { reference: string; expiryHours: number },
): Promise<void> {
  const expiresAt = new Date(Date.now() + opts.expiryHours * 3600_000).toISOString();
  const { error } = await adminDb()
    .from("orders")
    .update({
      payment_reference: opts.reference,
      payment_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(`setOrderPaymentPlan: ${error.message}`);
}

export async function markPaid(
  orderId: string,
  opts: {
    actor?: string;
    paymentRef?: string;
    paymentMethod?: string;
    /** False when this order already counted its discount on a previous payment
     *  (a reinstated order that had been paid before). Default true. */
    countDiscount?: boolean;
  } = {},
): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (order.stock_settled) return; // idempotent — already settled
  if (!canTransition(order.status, "paid"))
    throw new Error(`Cannot mark paid from '${order.status}'.`);

  const items = await orderItems(orderId);
  for (const it of items) {
    await recordMovement({
      variantId: it.variant_id,
      qty: -it.qty,
      reason: "sale",
      actor: opts.actor,
      orderId,
    });
    await releaseStock(it.variant_id, it.qty);
  }

  // Freeze COGS onto the lines at the moment of sale. Later supplier price
  // changes must never rewrite this order's profit.
  await snapshotOrderCosts(orderId);

  await db
    .from("orders")
    .update({
      status: "paid",
      stock_settled: true,
      paid_at: new Date().toISOString(),
      payment_ref: opts.paymentRef ?? null,
      payment_method: opts.paymentMethod ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (order.discount_code && opts.countDiscount !== false)
    await incrementDiscountUsage(order.discount_code);

  await addEvent(orderId, "payment", { message: "Payment confirmed.", actor: opts.actor });
  await addEvent(orderId, "status", { from: order.status, to: "paid", actor: opts.actor });
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.paid",
    entityType: "order",
    entityId: orderId,
    diff: { payment_ref: opts.paymentRef ?? null },
  });
}

/** Generic forward transition (processing / shipped / completed). */
export async function setStatus(
  orderId: string,
  to: OrderStatus,
  opts: { actor?: string; trackingNumber?: string } = {},
): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (!canTransition(order.status, to))
    throw new Error(`Illegal transition '${order.status}' → '${to}'.`);

  const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() };
  if (to === "shipped") {
    patch.tracking_number = opts.trackingNumber ?? null;
    patch.shipped_at = new Date().toISOString();
  }
  await db.from("orders").update(patch).eq("id", orderId);

  await addEvent(orderId, "status", { from: order.status, to, actor: opts.actor });
  if (to === "shipped") {
    await addEvent(orderId, "email", {
      message: `Shipping notification queued${opts.trackingNumber ? ` (tracking ${opts.trackingNumber})` : ""}.`,
      actor: opts.actor,
    });
  }
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.status",
    entityType: "order",
    entityId: orderId,
    diff: { from: order.status, to, tracking: opts.trackingNumber ?? null },
  });
}

/** Days after dispatch that an unrefunded shipped order is considered delivered. */
export const AUTO_COMPLETE_DAYS = 10;

/**
 * Close out orders that shipped long enough ago to be considered delivered.
 *
 * `shipped` means "in the customer's hands or on the way"; `completed` means
 * "nothing further is expected". Nobody was ever going to click through weeks of
 * shipped orders to say so, which left the queue permanently misleading about
 * what still needed attention.
 *
 * Ten days is a claim about delivery, not about satisfaction — refunds stay
 * possible from `completed`, so nothing is taken away from the customer by
 * closing the order. Anything already refunded or cancelled is untouched
 * because it is no longer `shipped`.
 *
 * Goes through setStatus so each order still gets its event and audit line: an
 * order that silently changed state would be worse than one left open.
 */
export async function completeDeliveredOrders(): Promise<{ completed: number; failed: number }> {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_DAYS * 86_400_000).toISOString();
  const { data, error } = await adminDb()
    .from("orders")
    .select("id, order_number")
    .eq("status", "shipped")
    .not("shipped_at", "is", null)
    .lt("shipped_at", cutoff)
    .limit(200);
  if (error) throw new Error(`completeDeliveredOrders: ${error.message}`);

  let completed = 0;
  let failed = 0;
  for (const order of (data ?? []) as { id: string; order_number: string }[]) {
    try {
      await setStatus(order.id, "completed", { actor: "system:auto-complete" });
      completed++;
    } catch (err) {
      // One stuck order must not strand the rest of the batch.
      console.error(`completeDeliveredOrders: ${order.order_number} failed:`, err);
      failed++;
    }
  }
  return { completed, failed };
}

/** Cancel an order. Releases the reservation (if not yet settled) or restores stock. */
export async function cancelOrder(orderId: string, opts: { actor?: string } = {}): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (!canTransition(order.status, "cancelled"))
    throw new Error(`Cannot cancel from '${order.status}'.`);

  const items = await orderItems(orderId);
  if (order.stock_settled && !order.stock_restored) {
    for (const it of items)
      await recordMovement({ variantId: it.variant_id, qty: it.qty, reason: "return", orderId, actor: opts.actor });
    await db.from("orders").update({ stock_restored: true }).eq("id", orderId);
  } else if (order.stock_reserved && !order.stock_settled) {
    for (const it of items) await releaseStock(it.variant_id, it.qty);
  }

  await db.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId);
  await addEvent(orderId, "status", { from: order.status, to: "cancelled", actor: opts.actor });
  await logAudit({ actor: opts.actor ?? "system", action: "order.cancel", entityType: "order", entityId: orderId });
}

/* ---------------- reinstatement -------------------------------------------- */

export interface ReinstateLineCheck {
  variantId: string;
  productName: string | null;
  variantLabel: string | null;
  qty: number;
  available: number;
  sufficient: boolean;
}

/**
 * Can this cancelled order be brought back, and what is short if not?
 *
 * Read-only. Exists so the admin can show the answer BEFORE the operator
 * commits — a button that only fails on click teaches nothing about why.
 */
export async function reinstateStockCheck(orderId: string): Promise<ReinstateLineCheck[]> {
  const map = await reinstatabilityFor([orderId]);
  return map.get(orderId)?.lines ?? [];
}

export interface OrderReinstatability {
  recoverable: boolean;
  lines: ReinstateLineCheck[];
  /** Lines that cannot be filled — the reason it is not recoverable. */
  short: ReinstateLineCheck[];
}

/**
 * Can each of these cancelled orders be brought back, and what blocks the ones
 * that cannot?
 *
 * Demand is accumulated PER POOL across an order's lines, not measured line by
 * line. A 3-pack and a single vial of the same product draw on one vial pool, so
 * judging them independently reports enough stock for both when there is only
 * enough for one — the preview would say go and the reinstate would then refuse,
 * which is precisely the whipsaw this check exists to prevent.
 *
 * Four queries regardless of how many orders are passed in, so the orders list
 * can afford to call it for a whole page.
 */
export async function reinstatabilityFor(
  orderIds: string[],
): Promise<Map<string, OrderReinstatability>> {
  const result = new Map<string, OrderReinstatability>();
  if (!orderIds.length) return result;

  const { data: itemRows } = await adminDb()
    .from("order_items")
    .select("order_id, variant_id, qty, product_name, variant_label")
    .in("order_id", orderIds);
  const items = ((itemRows ?? []) as {
    order_id: string;
    variant_id: string | null;
    qty: number;
    product_name: string | null;
    variant_label: string | null;
  }[]).filter((i) => i.variant_id);

  const pools = await resolvePoolsFor(items.map((i) => i.variant_id as string));
  const availability = await poolAvailability(
    [...pools.values()].map((p) => p.poolVariantId),
  );

  for (const orderId of orderIds) {
    // Each order is judged against the shelf as it stands now, so a running
    // tally per pool resets between orders — two cancelled orders wanting the
    // same last vial are each individually recoverable, and whichever is
    // reinstated first takes it.
    const remaining = new Map<string, number>();
    const lines: ReinstateLineCheck[] = [];

    for (const item of items.filter((i) => i.order_id === orderId)) {
      const pool = pools.get(item.variant_id as string);
      const poolId = pool?.poolVariantId ?? (item.variant_id as string);
      const needed = item.qty * (pool?.packSize ?? 1);

      const free = remaining.get(poolId) ?? availability.get(poolId) ?? 0;
      const sufficient = free >= needed;
      remaining.set(poolId, free - needed);

      lines.push({
        variantId: item.variant_id as string,
        productName: item.product_name,
        variantLabel: item.variant_label,
        qty: item.qty,
        available: Math.max(0, free),
        sufficient,
      });
    }

    const short = lines.filter((l) => !l.sufficient);
    result.set(orderId, { recoverable: lines.length > 0 && short.length === 0, lines, short });
  }

  return result;
}

/**
 * Bring a cancelled order back to life — the late payer's path.
 *
 * Cancelling RELEASED this order's claim on stock, so reinstating is not a
 * status flip: the claim has to be taken again, and in the days since, someone
 * else may have bought the last vial. Every line is re-reserved through the
 * same atomic reserve_stock() the storefront uses, and if any line comes up
 * short the reservations already taken in this call are handed back before
 * throwing. Half-reinstating an order would silently strand stock.
 *
 * The order returns to `pending` rather than jumping straight to paid, so the
 * money still travels the one audited path — markPaid — that records the sale
 * movement, freezes COGS and emails the customer. `toPaid` runs that second
 * step for the operator; it does not replace it.
 */
export async function reinstateOrder(
  orderId: string,
  opts: { actor?: string; toPaid?: boolean; paymentRef?: string } = {},
): Promise<{ reinstatedTo: OrderStatus }> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (order.status !== "cancelled")
    throw new Error(`Only cancelled orders can be reinstated (this one is '${order.status}').`);

  const { data: itemRows } = await db
    .from("order_items")
    .select("variant_id, qty, product_name, variant_label")
    .eq("order_id", orderId);
  const items = ((itemRows ?? []) as {
    variant_id: string | null;
    qty: number;
    product_name: string | null;
    variant_label: string | null;
  }[]).filter((i) => i.variant_id);

  const taken: { variantId: string; qty: number }[] = [];
  for (const it of items) {
    const ok = await reserveStock(it.variant_id as string, it.qty);
    if (!ok) {
      for (const undo of taken) await releaseStock(undo.variantId, undo.qty);
      const label = [it.product_name, it.variant_label].filter(Boolean).join(" · ") || "an item";
      throw new Error(
        `Not enough stock to reinstate: ${label} needs ${it.qty} but there isn't that much available. Restock first, then reinstate.`,
      );
    }
    taken.push({ variantId: it.variant_id as string, qty: it.qty });
  }

  // Back to the pending shape in full: a reinstated order that kept
  // stock_settled would make markPaid's idempotency guard skip the sale.
  const settings = await getSettings();
  await db
    .from("orders")
    .update({
      status: "pending",
      stock_reserved: true,
      stock_settled: false,
      stock_restored: false,
      paid_at: null,
      payment_expires_at: new Date(
        Date.now() + settings.paymentExpiryHours * 3600_000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await addEvent(orderId, "status", {
    from: "cancelled",
    to: "pending",
    message: "Reinstated by an admin; stock re-reserved.",
    actor: opts.actor,
  });
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.reinstate",
    entityType: "order",
    entityId: orderId,
    diff: { to: opts.toPaid ? "paid" : "pending", lines: items.length },
  });

  if (!opts.toPaid) return { reinstatedTo: "pending" };

  await markPaid(orderId, {
    actor: opts.actor,
    paymentRef: opts.paymentRef,
    // A previously-paid order already counted its discount; counting again on
    // reinstatement would eat a second use of a limited code.
    countDiscount: !order.stock_settled,
  });
  return { reinstatedTo: "paid" };
}

/** Refund an order. Restores stock via return movements (idempotent). */
export async function refundOrder(orderId: string, opts: { actor?: string } = {}): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (!canTransition(order.status, "refunded"))
    throw new Error(`Cannot refund from '${order.status}'.`);

  if (order.stock_settled && !order.stock_restored) {
    const items = await orderItems(orderId);
    for (const it of items)
      await recordMovement({ variantId: it.variant_id, qty: it.qty, reason: "return", orderId, actor: opts.actor });
    await db.from("orders").update({ stock_restored: true }).eq("id", orderId);
  }

  // Mark the LINES refunded, not just the order. Anything that reports per
  // product reads order_items.refunded_qty — leaving those at zero made a
  // fully-refunded order still count as a sale in the products report while
  // the dashboard correctly showed it as refunded. Same event, two answers.
  const { data: lines } = await db
    .from("order_items")
    .select("id, qty, refunded_qty, line_total_cents")
    .eq("order_id", orderId);
  for (const line of lines ?? []) {
    const qty = (line.qty as number) ?? 0;
    if (((line.refunded_qty as number) ?? 0) >= qty) continue;
    await db
      .from("order_items")
      .update({ refunded_qty: qty, refunded_cents: line.line_total_cents })
      .eq("id", line.id);
  }

  // Record the amount, not just the status.
  await db
    .from("orders")
    .update({
      status: "refunded",
      refunded_cents: order.total_cents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  await addEvent(orderId, "status", { from: order.status, to: "refunded", actor: opts.actor });
  await logAudit({ actor: opts.actor ?? "system", action: "order.refund", entityType: "order", entityId: orderId });
}

// ---------------------------------------------------------------------------
// Partial refunds (line-level)
//
// FirstPrinciples invariants (see ISA Changelog for the full analysis):
//  1. "how much is left to refund" is read from order_items.refunded_qty —
//     NEVER trusted from the caller. qty <= item.qty - item.refunded_qty, always.
//  2. Stock is restored only if the order's stock was actually decremented
//     (stock_settled). A still-pending order's lines were only RESERVED, so
//     refunding them releases the reservation instead of fabricating a return.
//  3. "Fully refunded" is DERIVED (every line's refunded_qty == qty), not a
//     second flag that can drift from the line data.
// ---------------------------------------------------------------------------

export interface LineRefund {
  itemId: string;
  qty: number;
}

interface FullOrderItemRow {
  id: string;
  variant_id: string | null;
  qty: number;
  refunded_qty: number;
  refunded_cents: number;
  unit_price_cents: number;
}

export interface RefundItemsResult {
  refundedCents: number;
  fullyRefunded: boolean;
}

/** Refund specific quantities of specific lines. Works on pending or paid+ orders. */
export async function refundOrderItems(
  orderId: string,
  refunds: LineRefund[],
  opts: { actor?: string } = {},
): Promise<RefundItemsResult> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (order.status === "cancelled" || order.status === "refunded")
    throw new Error(`Cannot refund an order that is already ${order.status}.`);
  if (!refunds.length) throw new Error("No refund lines provided.");

  const ids = refunds.map((r) => r.itemId);
  const { data: rows, error } = await db
    .from("order_items")
    .select("id, variant_id, qty, refunded_qty, refunded_cents, unit_price_cents")
    .in("id", ids)
    .eq("order_id", orderId);
  if (error) throw new Error(`refundOrderItems: ${error.message}`);
  const byId = new Map((rows as FullOrderItemRow[]).map((r) => [r.id, r]));

  let refundedCents = 0;
  for (const r of refunds) {
    const item = byId.get(r.itemId);
    if (!item) throw new Error(`Order item ${r.itemId} not found on this order.`);
    const remaining = item.qty - item.refunded_qty;
    if (r.qty <= 0 || r.qty > remaining)
      throw new Error(`Cannot refund ${r.qty} — only ${remaining} left to refund on this line.`);

    const amountCents = item.unit_price_cents * r.qty;
    refundedCents += amountCents;

    // Absolute-value write from the row just read. Refund calls on a single order
    // are issued sequentially by one admin action — never concurrently — so this
    // read-then-write is safe without a Postgres-side atomic increment.
    await db
      .from("order_items")
      .update({
        refunded_qty: item.refunded_qty + r.qty,
        refunded_cents: item.refunded_cents + amountCents,
      })
      .eq("id", r.itemId);

    // Stock: restore only what was actually decremented. A pending order's lines
    // were only reserved — release the reservation instead of a phantom return.
    if (item.variant_id) {
      if (order.stock_settled) {
        await recordMovement({
          variantId: item.variant_id,
          qty: r.qty,
          reason: "return",
          orderId,
          actor: opts.actor,
          note: "partial refund",
        });
      } else {
        await releaseStock(item.variant_id, r.qty);
      }
    }
  }

  // Fully refunded is derived: re-read every line and check the sums.
  const { data: allItems } = await db
    .from("order_items")
    .select("qty, refunded_qty")
    .eq("order_id", orderId);
  const fullyRefunded = (allItems ?? []).every((i) => i.refunded_qty >= i.qty);

  // When every line is refunded, shipping is refunded too (parity with the
  // full-order refundOrder() path) — orders.refunded_cents lands exactly on
  // total_cents rather than stopping short by the shipping amount.
  const newRefundedCents = fullyRefunded
    ? order.total_cents
    : order.refunded_cents + refundedCents;

  await db
    .from("orders")
    .update({ refunded_cents: newRefundedCents, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (fullyRefunded && canTransition(order.status, "refunded")) {
    await db.from("orders").update({ status: "refunded", stock_restored: true }).eq("id", orderId);
    await addEvent(orderId, "status", { from: order.status, to: "refunded", actor: opts.actor });
  }

  await addEvent(orderId, "refund", {
    message: `Refunded ${refunds.reduce((s, r) => s + r.qty, 0)} item(s) — $${(refundedCents / 100).toFixed(2)}`,
    actor: opts.actor,
  });
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.refund_partial",
    entityType: "order",
    entityId: orderId,
    diff: { refunds, refundedCents, fullyRefunded },
  });

  return { refundedCents, fullyRefunded };
}

// ---------------------------------------------------------------------------
// Pending-order editing (pre-payment only — stock is still just a reservation)
// ---------------------------------------------------------------------------

/** Adjust a line's quantity on a still-pending order. Re-reserves/releases stock
 *  and recalculates totals server-side. Throws if stock is insufficient. */
export async function updatePendingOrderItemQty(
  orderId: string,
  itemId: string,
  newQty: number,
  opts: { actor?: string } = {},
): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (order.status !== "pending")
    throw new Error("Only pending orders can have their quantities edited.");
  if (newQty < 0) throw new Error("Quantity cannot be negative.");

  const { data: item } = await db
    .from("order_items")
    .select("id, variant_id, qty, unit_price_cents")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!item) throw new Error("Order item not found.");

  if (newQty === 0) {
    await removeOrderItem(orderId, itemId, opts);
    return;
  }

  const delta = newQty - item.qty;
  if (item.variant_id && delta > 0) {
    const ok = await reserveStock(item.variant_id, delta);
    if (!ok) throw new Error("Not enough stock available for that quantity.");
  } else if (item.variant_id && delta < 0) {
    await releaseStock(item.variant_id, -delta);
  }

  await db
    .from("order_items")
    .update({ qty: newQty, line_total_cents: item.unit_price_cents * newQty })
    .eq("id", itemId);

  await recalculateOrderTotals(orderId);
  await addEvent(orderId, "edit", { message: `Item quantity changed to ${newQty}.`, actor: opts.actor });
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.edit_qty",
    entityType: "order",
    entityId: orderId,
    diff: { itemId, from: item.qty, to: newQty },
  });
}

/** Remove a line entirely from a still-pending order (releases its reservation). */
export async function removeOrderItem(
  orderId: string,
  itemId: string,
  opts: { actor?: string } = {},
): Promise<void> {
  const db = adminDb();
  const order = await loadOrder(orderId);
  if (order.status !== "pending")
    throw new Error("Only pending orders can have items removed.");

  const { data: item } = await db
    .from("order_items")
    .select("id, variant_id, qty, product_name")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!item) throw new Error("Order item not found.");

  if (item.variant_id) await releaseStock(item.variant_id, item.qty);
  await db.from("order_items").delete().eq("id", itemId);

  await recalculateOrderTotals(orderId);
  await addEvent(orderId, "edit", { message: `Removed ${item.product_name ?? "item"} from order.`, actor: opts.actor });
  await logAudit({
    actor: opts.actor ?? "system",
    action: "order.remove_item",
    entityType: "order",
    entityId: orderId,
    diff: { itemId },
  });
}

/** Recompute subtotal/discount/shipping/total from the current line items —
 *  the same server-authoritative math createOrder uses, so an edited order's
 *  total is never hand-adjusted. */
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const db = adminDb();
  const { data: items } = await db
    .from("order_items")
    .select("line_total_cents")
    .eq("order_id", orderId);
  const subtotal = (items ?? []).reduce((s, i) => s + (i.line_total_cents as number), 0);

  const { data: order } = await db
    .from("orders")
    .select("discount_code, shipping_address")
    .eq("id", orderId)
    .maybeSingle();

  let discountCents = 0;
  if (order?.discount_code) {
    const d = await validateDiscount(order.discount_code, subtotal);
    if (d.ok) discountCents = d.discountCents;
  }
  const afterDiscount = subtotal - discountCents;
  // Re-price shipping on the method the customer actually chose — recalculating
  // an express order at the standard rate would quietly refund them the
  // difference every time an admin edited a line.
  const chosen = (order?.shipping_address as { shipping_method?: unknown } | null)?.shipping_method;
  const method = isShippingMethod(chosen) ? chosen : "standard";
  const shippingCents = shippingCentsFor(afterDiscount, method, await getSettings()).cents;
  const total = afterDiscount + shippingCents;

  await db
    .from("orders")
    .update({
      subtotal_cents: subtotal,
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      total_cents: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}
