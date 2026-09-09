"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import {
  markPaid,
  updateOrderTracking,
  setStatus,
  updatePendingOrderItemQty,
  removeOrderItem,
  cancelOrder,
  reinstateOrder,
  type OrderStatus,
} from "@/lib/admin/orders";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}


function fail(err: unknown): ActionResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: msg };
}

/** Confirm a bank-transfer/manual payment: → paid, decrements stock, emails receipt. */
export async function confirmPayment(orderId: string, paymentRef?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await markPaid(orderId, { actor: session.email, paymentRef: paymentRef?.trim() || undefined });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Bring a cancelled order back — the late payer's path.
 *
 * `toPaid` is the common case: the money landed days after the hold expired, so
 * the operator wants one click, not "reinstate, find the order again, confirm
 * payment". The confirmation email only goes out on the paid path, because a
 * reinstated-but-unpaid order has nothing to confirm yet.
 */
export async function reinstate(
  orderId: string,
  opts: { toPaid?: boolean; paymentRef?: string; idempotencyKey?:string } = {},
): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await reinstateOrder(orderId, {
      actor: session.email,
      toPaid: opts.toPaid,
      idempotencyKey:opts.idempotencyKey,
      paymentRef: opts.paymentRef?.trim() || undefined,
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Reinstate several cancelled orders at once, straight to paid.
 *
 * Per-order isolation matters more here than anywhere else in the bulk bar: a
 * batch of late payers will routinely contain one order whose stock is gone,
 * and that must not stop the others from going through.
 */
export async function bulkReinstate(
  orderIds: string[],
): Promise<ActionResult & { done: number; failed: { id: string; error: string }[] }> {
  const session = await requireAdmin();
  let done = 0;
  const failed: { id: string; error: string }[] = [];

  for (const id of orderIds) {
    try {
      await reinstateOrder(id, { actor: session.email, toPaid: true });
      done++;
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: failed.length === 0, done, failed };
}

/** Forward transition. Shipping captures tracking and queues the customer email. */
export async function advanceStatus(
  orderId: string,
  to: OrderStatus,
  trackingNumber?: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!["processing", "shipped", "completed"].includes(to)) return { ok: false, error: "Use the dedicated reviewed order action." };
  try {
    await setStatus(orderId, to, { actor: session.email, trackingNumber: trackingNumber?.trim() || undefined });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Bulk fulfilment: advance many orders at once (typically → shipped). Each order
 * still goes through setStatus, so stock settlement, events and emails stay
 * identical to the single-order path. Failures are collected, not swallowed —
 * a partial batch reports exactly which orders didn't move.
 */
export async function bulkAdvanceStatus(
  orderIds: string[],
  to: OrderStatus,
): Promise<ActionResult & { moved?: number; failed?: {id:string;error:string}[] }> {
  const session = await requireAdmin();
  if (!orderIds.length) return { ok: false, error: "No orders selected." };
  if (!["processing", "shipped", "completed"].includes(to)) return { ok: false, error: "Use the dedicated reviewed order action." };

  const failed: {id:string;error:string}[] = [];
  let moved = 0;
  for (const id of orderIds) {
    try {
      await setStatus(id, to, { actor: session.email });
      moved++;
    } catch(err) {failed.push({id,error:err instanceof Error ? err.message : String(err)});}
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  if (!moved) return { ok: false, error: `Nothing moved. Failed: ${failed.map(f=>f.id).join(", ")}`, failed };
  return { ok: true, moved, failed };
}

/**
 * Bulk payment confirmation: mark many pending orders paid at once. Each order
 * goes through markPaid, so stock settlement, COGS snapshots, events and the
 * receipt email stay identical to the single-order path. Failures are collected
 * per order — a partial batch reports exactly which orders didn't move.
 */
export async function bulkConfirmPayment(
  orderIds: string[],
): Promise<ActionResult & { moved?: number; failed?: {id:string;error:string}[] }> {
  const session = await requireAdmin();
  if (!orderIds.length) return { ok: false, error: "No orders selected." };

  const failed: {id:string;error:string}[] = [];
  let moved = 0;
  for (const id of orderIds) {
    try {
      await markPaid(id, { actor: session.email });
      moved += 1;
    } catch (err) {
      failed.push({id,error:err instanceof Error ? err.message : String(err)});
      console.error(`bulkConfirmPayment(${id}):`, err);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  if (!moved) return { ok: false, error: `Nothing moved. Failed: ${failed.map(f=>f.id).join(", ")}`, failed };
  return { ok: true, moved, failed };
}

/** Edit a line's quantity on a still-pending order (server-priced, stock-safe). */
export async function editItemQty(orderId: string, itemId: string, newQty: number): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await updatePendingOrderItemQty(orderId, itemId, newQty, { actor: session.email });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Remove a line entirely from a still-pending order. */
export async function removeItem(orderId: string, itemId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await removeOrderItem(orderId, itemId, { actor: session.email });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function cancel(orderId: string, restock = false): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await cancelOrder(orderId, { actor: session.email, restock });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Internal note — appears in the order timeline. */
export async function addNote(orderId: string, message: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const text = message.trim();
  if (!text) return { ok: false, error: "Note is empty." };
  try {
    const {error} = await adminDb().from("order_events").insert({
      order_id: orderId,
      type: "note",
      message: text,
      actor_email: session.email,
    });
    if(error)throw new Error(error.message);
    await logAudit({
      actor: session.email,
      action: "order.note",
      entityType: "order",
      entityId: orderId,
      diff: { message: text },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function correctTracking(orderId:string,trackingNumber:string,notify=false):Promise<ActionResult>{
 const session=await requireAdmin();
 try{
  await updateOrderTracking(orderId,trackingNumber,{actor:session.email,notify});
  revalidatePath(`/admin/orders/${orderId}`);revalidatePath("/admin/orders");return {ok:true};
 }catch(err){return fail(err);}
}
