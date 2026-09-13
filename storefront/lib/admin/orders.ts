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
import { getSettings } from "@/lib/settings";
import type { ResolvedCartLine } from "@/lib/checkout";
import type { OrderAttribution } from "@/lib/attribution";

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

export interface NewOrderItem {
  variantId: string;
  qty: number;
  /** Deprecated: ignored. Labels and subscription flags never grant discounts. */
  discountPct?: number;
  /** Server-derived price override in cents (e.g. a $0 gift vial). */
  priceOverrideCents?: number;
  /** DB list price observed while quoting; checked again under the create transaction. */
  expectedPriceCents?: number;
  /** Appended to the stored variant label (e.g. " · Recovery Stack"). */
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
  idempotencyKey?: string;
  paymentExpiryHours?: number;
  expectedTotalCents?: number;
  /** Server hash of the original normalized client request, never a client-supplied hash. */
  requestFingerprint?: string;
  /** Optional GA client ID read from the real first-party _ga cookie on the server. */
  analyticsClientId?: string;
  /** Validated consented first-party acquisition/experiment snapshot. */
  orderAttribution?: OrderAttribution;
  /** Trusted server resolver snapshot; never copy browser-supplied priced lines. */
  purchasedLines?: ResolvedCartLine[];
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  paymentReference: string;
  paymentExpiresAt: string;
  replayed: boolean;
  /** Absent for older orders created before checkout snapshots were recorded. */
  purchasedLines?: ResolvedCartLine[];
}

/** All business writes, events and stock changes commit in this one RPC. */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const settings = await getSettings();
  const { data, error } = await adminDb().rpc("commerce_create_order", {
    p_input: {
      ...input,
      email: input.email.trim().toLowerCase(),
      paymentExpiryHours: input.paymentExpiryHours ?? settings.paymentExpiryHours,
      shippingPolicy: {
        baseCents: settings.standardShippingCents,
        freeThresholdCents: Math.round(settings.freeShippingThreshold * 100),
      },
    },
  });
  if (error) throw new Error(`createOrder: ${error.message}`);
  if (!data?.orderId) throw new Error("createOrder: missing committed order");
  return data as CreatedOrder;
}

export async function findCheckoutReplay(idempotencyKey: string, requestFingerprint: string): Promise<CreatedOrder | null> {
  const { data, error } = await adminDb().rpc("commerce_checkout_replay", { p_key: idempotencyKey, p_fingerprint: requestFingerprint });
  if (error) throw new Error(`checkout replay: ${error.message}`);
  return data as CreatedOrder | null;
}

export interface OrderOperationOptions { actor?: string; idempotencyKey?: string }
export interface RestockOptions extends OrderOperationOptions { restock?: boolean }
interface OperationResult {
  changed: boolean;
  status: OrderStatus;
  reinstatedTo: OrderStatus;
  refundedCents: number;
  fullyRefunded: boolean;
}
async function operation(orderId: string, action: string, options: object = {}): Promise<OperationResult> {
  const { data, error } = await adminDb().rpc("commerce_order_operation", {
    p_order: orderId, p_action: action, p_options: options,
  });
  if (error) throw new Error(`${action}: ${error.message}`);
  if (!data) throw new Error(`${action}: missing operation result`);
  return data as OperationResult;
}

/** Legacy compatibility: new orders always have this plan at atomic creation.
 * Only fill missing values; retries must never extend a hold window. */
export async function setOrderPaymentPlan(orderId: string, opts: { reference: string; expiryHours: number }): Promise<void> {
  if (!Number.isInteger(opts.expiryHours) || opts.expiryHours < 1 || opts.expiryHours > 720) throw new Error("Invalid payment expiry");
  const { error } = await adminDb().rpc("commerce_set_payment_plan", { p_order: orderId, p_reference: opts.reference, p_expiry_hours: opts.expiryHours });
  if (error) throw new Error(`setOrderPaymentPlan: ${error.message}`);
}

export async function markPaid(orderId: string, opts: OrderOperationOptions & { paymentRef?: string; paymentMethod?: string; countDiscount?: boolean } = {}): Promise<void> {
  await operation(orderId, "paid", opts);
}
export async function setStatus(orderId: string, to: OrderStatus, opts: OrderOperationOptions & { trackingNumber?: string } = {}): Promise<void> {
  await operation(orderId, to, opts);
}
export async function updateOrderTracking(orderId: string, trackingNumber: string, opts: OrderOperationOptions & { notify?: boolean } = {}): Promise<void> {
  if (trackingNumber.length > 200) throw new Error("Tracking number is too long");
  await operation(orderId, "tracking", { ...opts, trackingNumber });
}
/** Safe against a payment arriving between a cron read and its cancellation. */
export async function expireOrder(orderId: string): Promise<boolean> {
  return (await operation(orderId, "expire", { actor: "system:payment-expiry" })).changed;
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
export async function cancelOrder(orderId: string, opts: RestockOptions = {}): Promise<void> {
  await operation(orderId, "cancelled", opts);
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

/** Read-only preview of frozen pool claims; the mutation rechecks under locks. */
export async function reinstatabilityFor(orderIds: string[]): Promise<Map<string, OrderReinstatability>> {
  const result = new Map<string, OrderReinstatability>();
  if (!orderIds.length) return result;
  const { data, error } = await adminDb().rpc("commerce_reinstatement_preview", { p_orders: orderIds });
  if (error) throw new Error(`reinstatabilityFor: ${error.message}`);
  for (const row of (data ?? []) as { order_id: string; recoverable: boolean; lines: ReinstateLineCheck[] }[]) {
    result.set(row.order_id, { recoverable: row.recoverable, lines: row.lines, short: row.lines.filter((line) => !line.sufficient) });
  }
  return result;
}

/** Re-reservation and optional payment settle together or not at all. */
export async function reinstateOrder(orderId: string, opts: OrderOperationOptions & { toPaid?: boolean; paymentRef?: string } = {}): Promise<{ reinstatedTo: OrderStatus }> {
  const settings = await getSettings();
  const result = await operation(orderId, "reinstate", { ...opts, paymentExpiryHours: settings.paymentExpiryHours });
  return { reinstatedTo: result.reinstatedTo };
}
export async function refundOrder(orderId: string, opts: RestockOptions = {}): Promise<void> {
  await operation(orderId, "refunded", opts);
}
export interface LineRefund { itemId: string; qty: number }
export interface RefundItemsResult { refundedCents: number; fullyRefunded: boolean }
export async function refundOrderItems(orderId: string, refunds: LineRefund[], opts: RestockOptions = {}): Promise<RefundItemsResult> {
  const result = await operation(orderId, "refund_items", { ...opts, refunds });
  return { refundedCents: result.refundedCents, fullyRefunded: result.fullyRefunded };
}

export async function updatePendingOrderItemQty(orderId: string, itemId: string, newQty: number, opts: OrderOperationOptions = {}): Promise<void> {
  if (!Number.isInteger(newQty) || newQty < 0 || newQty > 99) throw new Error("Quantity must be an integer from 0 to 99");
  const settings = await getSettings();
  const { data: order, error } = await adminDb().from("orders").select("shipping_address").eq("id", orderId).maybeSingle();
  if (error) throw new Error(`load shipping method: ${error.message}`);
  if (!order) throw new Error("Order not found");
  const express = order.shipping_address?.shipping_method === "express" && settings.expressShippingEnabled;
  await operation(orderId, "edit_item", { ...opts, itemId, qty: newQty, shippingPolicy: {
    baseCents: express ? settings.expressShippingCents : settings.standardShippingCents,
    freeThresholdCents: Math.round((express ? settings.expressFreeThreshold : settings.freeShippingThreshold) * 100),
  } });
}
export async function removeOrderItem(orderId: string, itemId: string, opts: OrderOperationOptions = {}): Promise<void> {
  await updatePendingOrderItemQty(orderId, itemId, 0, opts);
}
