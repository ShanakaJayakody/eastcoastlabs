import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import DiscountsManager, { type DiscountRow } from "@/components/admin/DiscountsManager";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdmin();
  const db = adminDb();
  const [{ data }, { data: used }] = await Promise.all([
    db.from("discounts").select("*").order("code"),
    // Redemptions counted from the orders themselves rather than trusting
    // `used_count`, which is a counter that can drift from what actually
    // happened. This is also what makes each code linkable to its orders.
    db.from("orders").select("discount_code, total_cents").not("discount_code", "is", null),
  ]);

  const redeemed = new Map<string, { orders: number; revenueCents: number }>();
  for (const row of used ?? []) {
    const key = (row.discount_code as string).trim().toUpperCase();
    const entry = redeemed.get(key) ?? { orders: 0, revenueCents: 0 };
    entry.orders += 1;
    entry.revenueCents += (row.total_cents as number) ?? 0;
    redeemed.set(key, entry);
  }

  return (
    <DiscountsManager
      discounts={(data ?? []) as DiscountRow[]}
      redeemed={Object.fromEntries(redeemed)}
    />
  );
}
