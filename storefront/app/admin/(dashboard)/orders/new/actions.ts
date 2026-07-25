"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createOrder, markPaid } from "@/lib/admin/orders";

export interface ManualOrderInput {
  email: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string;
    postcode: string;
    phone?: string;
  };
  items: { variantId: string; qty: number }[];
  discountCode?: string;
  paymentMethod: string;
  markPaidNow: boolean;
  paymentRef?: string;
}

export type ManualOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

/**
 * Create an order the operator took by phone / bank transfer. Same server path as
 * the storefront checkout — prices come from the DB, stock is reserved — so a
 * manual order can never be mispriced or oversold.
 */
export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const session = await requireAdmin();

  if (!input.email?.includes("@")) return { ok: false, error: "Enter a valid customer email." };
  if (!input.name?.trim()) return { ok: false, error: "Enter the customer's name." };
  if (!input.items.length) return { ok: false, error: "Add at least one item." };
  if (!input.address?.line1?.trim() || !input.address.suburb?.trim())
    return { ok: false, error: "Enter a shipping address." };

  try {
    const order = await createOrder({
      email: input.email,
      name: input.name.trim(),
      shippingAddress: {
        line1: input.address.line1.trim(),
        line2: input.address.line2?.trim() || null,
        suburb: input.address.suburb.trim(),
        state: input.address.state,
        postcode: input.address.postcode.trim(),
        country: "AU",
        phone: input.address.phone?.trim() || null,
      },
      items: input.items,
      discountCode: input.discountCode?.trim() || undefined,
      paymentMethod: input.paymentMethod,
      actor: session.email,
    });

    if (input.markPaidNow) {
      await markPaid(order.orderId, {
        actor: session.email,
        paymentRef: input.paymentRef?.trim() || "manual",
        paymentMethod: input.paymentMethod,
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, orderId: order.orderId, orderNumber: order.orderNumber };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("OUT_OF_STOCK:"))
      return { ok: false, error: `Not enough stock for ${msg.split(":")[1]}.` };
    return { ok: false, error: msg };
  }
}
