"use server";

/**
 * Status lookup for the payment page poller.
 *
 * Deliberately returns nothing but the status string. The page itself is
 * already gated on knowing the order's UUID; this endpoint gets polled from the
 * browser on a timer, so it should leak as little as possible — no email, no
 * amount, no line items.
 */

import { supabaseAdmin } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrderPaymentStatus(orderId: string): Promise<string | null> {
  if (!UUID_RE.test(orderId)) return null;
  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  return (data?.status as string) ?? null;
}
