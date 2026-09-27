import StockManagement from "@/components/admin/StockManagement";
import { stockAttributionFixture } from "../fixtures/stock-attribution";
const report = stockAttributionFixture();
export default function StockManagementFixture() {
  return <div className="admin-theme space-y-6"><div><p className="text-xs text-muted">Catalogue</p><h1 className="mt-1 text-2xl font-semibold text-fg">Stock</h1></div><StockManagement report={report}/></div>;
}
