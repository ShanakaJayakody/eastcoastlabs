import { formatAud } from "@/lib/format";
import type { OrderDetail } from "@/lib/admin/order-queries";

const cents = (c: number) => formatAud(c / 100);

/**
 * One packing slip. Shared by the single-order print page and the batch print
 * page so both always render identically. `break-after-page` lets many slips
 * stack into a single print job, one per sheet.
 */
export default function PackingSlip({
  order,
  coas,
  pageBreak = false,
}: {
  order: OrderDetail;
  coas: Record<string, string>;
  pageBreak?: boolean;
}) {
  const addr = order.shipping_address ?? {};
  return (
    <section className={pageBreak ? "break-after-page" : ""}>
      <header className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">EAST COAST LABS</h1>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Research Peptides</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-bold">{order.order_number}</p>
          <p className="text-neutral-600">
            {new Date(order.created_at).toLocaleDateString("en-AU")}
          </p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
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
          {order.tracking_number && (
            <p className="font-mono text-xs">Tracking: {order.tracking_number}</p>
          )}
        </div>
      </div>

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
        <p className="font-bold uppercase">
          Research use only — not for human or animal consumption.
        </p>
        <p className="mt-1">
          Every batch is independently tested. Certificates of analysis are published at
          eastcoastlabs.com.au/lab-results
        </p>
      </footer>
    </section>
  );
}
