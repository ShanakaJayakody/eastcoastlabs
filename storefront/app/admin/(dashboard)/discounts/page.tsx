import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import DiscountsManager, { type DiscountRow } from "@/components/admin/DiscountsManager";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdmin();
  const { data } = await adminDb().from("discounts").select("*").order("code");
  return <DiscountsManager discounts={(data ?? []) as DiscountRow[]} />;
}
