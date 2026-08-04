import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/order-queries";
import { coaByCompound } from "@/lib/admin/slips";
import PackingSlip from "@/components/admin/PackingSlip";
import PrintButton from "@/components/admin/PrintButton";

// Deliberately OUTSIDE the (dashboard) route group: no sidebar, no topbar, so the
// printed page is just the slip. requireAdmin() still gates it.
export const dynamic = "force-dynamic";

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const names = [...new Set(order.items.map((i) => i.product_name ?? "").filter(Boolean))];
  const coas = await coaByCompound(names);

  return (
    <main className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      <PackingSlip order={order} coas={coas} />
    </main>
  );
}
