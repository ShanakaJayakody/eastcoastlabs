import { requireAdmin } from "@/lib/admin/auth";
import { getStockAttribution } from "@/lib/admin/stock-attribution-query";
import StockManagement from "@/components/admin/StockManagement";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireAdmin();
  const report = await getStockAttribution().catch(() => null);
  return <StockManagement report={report}/>;
}
