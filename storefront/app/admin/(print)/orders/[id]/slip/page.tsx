import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/order-queries";
import { adminDb } from "@/lib/admin/db";
import { formatAud } from "@/lib/format";
import PrintButton from "@/components/admin/PrintButton";

// Deliberately OUTSIDE the (dashboard) route group: no sidebar, no topbar, so the
// printed page is just the slip. requireAdmin() still gates it.
export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

/** Latest published COA batch per compound — printed alongside each line so the
 *  parcel carries its own proof of testing. */
async function coaByCompound(names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  const { data } = await adminDb()
    .from("coa_batches")
    .select("batch_id, compound, purity_pct, test_date")
    .order("test_date", { ascending: false });
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const compound = String(row.compound).toLowerCase();
    const match = names.find((n) => {
      const a = n.toLowerCase();
      return a === compound || a.includes(compound) || compound.includes(a);
    });
    if (match && !map[match]) map[match] = `${row.batch_id} · ${row.purity_pct}%`;
  }
  return map;
}

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const names = [...new Set(order.items.map((i) => i.product_name ?? "").filter(Boolean))];
  const coas = await coaByCompound(names);
  const addr = order.shipping_address ?? {};

  return (
    <main className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">EAST COAST LABS</h1>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Research Peptides</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-bold">{order.order_number}</p>
          <p className="text-neutral-600">{new Date(order.created_at).toLocaleDateString("en-AU")}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">Ship to</h2>
          <p className="font-medium">{order.customer_name}</p>
          <p>{addr.line1}</p>
          {addr.line2 && <p>{addr.line2}</p>}
          <p>
            {addr.suburb} {addr.state} {addr.postcode}
          </p>
          <p>{addr.country ?? "AU"}</p>
          {addr.phone && <p className="text-neutral-600">{addr.phone}</p>}
        </div>
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">Order</h2>
          <p>{order.customer_email}</p>
          <p className="capitalize text-neutral-600">Status: {order.status}</p>
          <p className="text-neutral-600">Payment: {order.payment_method ?? "—"}</p>
          {order.tracking_number && <p className="font-mono text-xs">Tracking: {order.tracking_number}</p>}
        </div>
      </section>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-2">Item</th>
            <th className="py-2">Batch / COA</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} className="border-b border-neutral-300">
              <td className="py-2">
                <span className="font-medium">{it.product_name}</span>
                <span className="block text-xs text-neutral-600">
                  {it.variant_label}
                  {it.sku ? ` · ${it.sku}` : ""}
                </span>
              </td>
              <td className="py-2 font-mono text-xs">{coas[it.product_name ?? ""] ?? "—"}</td>
              <td className="py-2 text-center">{it.qty}</td>
              <td className="py-2 text-right">{cents(it.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="py-2 text-right text-neutral-600">
              Subtotal
            </td>
            <td className="py-2 text-right">{cents(order.subtotal_cents)}</td>
          </tr>
          {order.discount_cents > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-neutral-600">
                Discount
              </td>
              <td className="text-right">−{cents(order.discount_cents)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="text-right text-neutral-600">
              Shipping
            </td>
            <td className="text-right">
              {order.shipping_cents === 0 ? "Free" : cents(order.shipping_cents)}
            </td>
          </tr>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={3} className="py-2 text-right">
              Total
            </td>
            <td className="py-2 text-right">{cents(order.total_cents)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-xs text-neutral-600">
        <p className="font-bold uppercase">Research use only — not for human or animal consumption.</p>
        <p className="mt-1">
          Every batch is independently tested. Certificates of analysis are published at
          eastcoastlabs.com.au/lab-results
        </p>
      </footer>
    </main>
  );
}
