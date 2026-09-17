import StockByPerson from "@/components/admin/StockByPerson";
import { stockAttributionFixture } from "../fixtures/stock-attribution";
const report = stockAttributionFixture();
export default function StockDashboardFixture() {
  return <div className="admin-theme space-y-6"><div><p className="text-xs text-muted">Synthetic dashboard preview</p><h1 className="mt-1 text-2xl font-semibold text-fg">Welcome back, Taylor</h1></div><StockByPerson report={report}/><div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">Your existing work queue, revenue and other dashboard panels continue below.</div></div>;
}
