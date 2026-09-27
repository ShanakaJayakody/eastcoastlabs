import Link from "next/link";
import { Boxes } from "lucide-react";
import StockByPerson from "./StockByPerson";
import type { StockAttribution } from "@/lib/admin/stock-attribution";

export default function StockManagement({ report }: { report: StockAttribution | null }) {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-fg">Stock management</h2>
        <p className="mt-1 text-sm text-muted">Track stock by person, review sales, and manage stock receipts and adjustments.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/products?low=1" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg-2 hover:text-fg">Low stock</Link>
        <Link href="/admin/products" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:brightness-95"><Boxes size={16}/>Receive or adjust stock</Link>
      </div>
    </div>
    {report ? <StockByPerson report={report}/> : <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-xl font-semibold text-fg">Stock by person</h2>
      <p role="status" className="mt-2 text-sm text-muted">Stock attribution could not be loaded. Refresh to try again; totals are unavailable.</p>
      <Link href="/admin/stock" className="mt-3 inline-block text-sm font-medium text-accent-2 underline">Try again</Link>
    </section>}
  </div>;
}
