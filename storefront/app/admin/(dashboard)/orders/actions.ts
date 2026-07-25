"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { markPaid, setStatus, refundOrder, cancelOrder, type OrderStatus } from "@/lib/admin/orders";
import { queueEmail } from "@/lib/admin/email";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function orderEmail(orderId: string): Promise<{ email: string; number: string } | null> {
  const { data } = await adminDb()
    .from("orders")
    .select("customer_email, order_number")
    .eq("id", orderId)
    .maybeSingle();
  return data ? { email: data.customer_email as string, number: data.order_number as string } : null;
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
    const info = await orderEmail(orderId);
    if (info)
      await queueEmail({
        to: info.email,
        template: "order_confirmation",
        payload: { order_number: info.number },
        relatedType: "order",
        relatedId: orderId,
      });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Forward transition. Shipping captures tracking and queues the customer email. */
export async function advanceStatus(
  orderId: string,
  to: OrderStatus,
  trackingNumber?: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await setStatus(orderId, to, { actor: session.email, trackingNumber: trackingNumber?.trim() || undefined });
    if (to === "shipped") {
      const info = await orderEmail(orderId);
      if (info)
        await queueEmail({
          to: info.email,
          template: "order_shipped",
          payload: { order_number: info.number, tracking_number: trackingNumber?.trim() ?? null },
          relatedType: "order",
          relatedId: orderId,
        });
    }
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function refund(orderId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await refundOrder(orderId, { actor: session.email });
    const info = await orderEmail(orderId);
    if (info)
      await queueEmail({
        to: info.email,
        template: "order_refunded",
        payload: { order_number: info.number },
        relatedType: "order",
        relatedId: orderId,
      });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function cancel(orderId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await cancelOrder(orderId, { actor: session.email });
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
    await adminDb().from("order_events").insert({
      order_id: orderId,
      type: "note",
      message: text,
      actor_email: session.email,
    });
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
