import { requireAdmin } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/order-queries";
import { coaByCompound } from "@/lib/admin/slips";
import PackingSlip from "@/components/admin/PackingSlip";
import PrintButton from "@/components/admin/PrintButton";

// Batch packing slips: many orders, one print job, one slip per page.
export const dynamic = "force-dynamic";

const MAX_SLIPS = 100;

export default async function BatchSlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireAdmin();
  const { ids } = await searchParams;
  const orderIds = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_SLIPS);

  const orders = (await Promise.all(orderIds.map((id) => getOrder(id)))).filter(
    (o): o is NonNullable<typeof o> => o != null,
  );

  const slips = await Promise.all(
    orders.map(async (order) => ({
      order,
      coas: await coaByCompound([
        ...new Set(order.items.map((i) => i.product_name ?? "").filter(Boolean)),
      ]),
    })),
  );

  return (
    <main className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {slips.length} packing slip{slips.length === 1 ? "" : "s"} — one per page
        </p>
        <PrintButton />
      </div>

      {slips.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No orders found for those IDs. Select orders in the admin list and choose “Print slips”.
        </p>
      ) : (
        slips.map(({ order, coas }, i) => (
          <PackingSlip
            key={order.id}
            order={order}
            coas={coas}
            pageBreak={i < slips.length - 1}
          />
        ))
      )}
    </main>
  );
}
