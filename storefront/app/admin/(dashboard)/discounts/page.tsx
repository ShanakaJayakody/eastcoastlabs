import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import DiscountsManager, { type DiscountRow } from "@/components/admin/DiscountsManager";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdmin();
  const db = adminDb();
  const [{ data }, { data: used }] = await Promise.all([
    db.from("discounts").select("*").order("code"),
    // Redemptions counted from the orders themselves, restricted to the same
    // population checkout's own `used_count` counts: orders that were actually
    // paid. Counting every order that merely *applied* a code would inflate the
    // usage shown against a code's limit and put cancelled orders' totals in a
    // column headed Revenue.
    db
      .from("orders")
      .select("discount_code, total_cents")
      .not("discount_code", "is", null)
      .in("status", ["paid", "processing", "shipped", "completed", "refunded"]),
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
