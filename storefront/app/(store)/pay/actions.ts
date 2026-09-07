"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { verifyOrderAccessToken } from "@/lib/order-access";

export async function getOrderPaymentStatus(orderId: string, token?: string): Promise<string | null> {
  if (verifyOrderAccessToken(token, "payment") !== orderId.toLowerCase()) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (error) throw new Error("Payment status is temporarily unavailable");
  return (data?.status as string) ?? null;
}
