"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { parseRevenueScale, revenueWindow, type RevenueWindow } from "@/lib/admin/order-queries";

/** Chart period stepping — the dashboard calls this in place so a click on
 *  "previous month" doesn't re-run every other dashboard read. Gated like any
 *  other admin data read. `anchor` null means "the window containing today". */
export async function loadRevenueWindow(
  scale: string,
  anchor: string | null,
): Promise<RevenueWindow> {
  await requireAdmin();
  return revenueWindow({ scale: parseRevenueScale(scale), anchor });
}
