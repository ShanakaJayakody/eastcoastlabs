import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/order-queries";
import { formatAud } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import OrderActions from "@/components/admin/OrderActions";

export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const addr = order.shipping_address ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="rounded-md p-1 text-muted hover:text-fg">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="font-mono text-lg font-semibold text-fg">{order.order_number}</h2>
            <p className="text-xs text-muted">
              Placed {new Date(order.created_at).toLocaleString("en-AU")}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <Link
          href={`/admin/orders/${order.id}/slip`}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg"
        >
          <Printer size={15} /> Packing slip
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold text-fg">Items</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3">
                      <span className="text-fg-2">{it.product_name}</span>
                      <span className="block text-xs text-muted">
                        {it.variant_label}
                        {it.sku ? ` · ${it.sku}` : " · accessory"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {cents(it.unit_price_cents)} × {it.qty}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-fg">
                      {cents(it.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-1.5 border-t border-line px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-fg-2">{cents(order.subtotal_cents)}</dd>
              </div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Discount {order.discount_code && <span className="font-mono text-xs">{order.discount_code}</span>}
                  </dt>
                  <dd className="text-success">−{cents(order.discount_cents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-fg-2">
                  {order.shipping_cents === 0 ? "Free" : cents(order.shipping_cents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-base">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="font-semibold text-fg">{cents(order.total_cents)}</dd>
              </div>
            </dl>
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold text-fg">Timeline</h3>
            </div>
            <ol className="divide-y divide-line">
              {order.events.map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <span className="text-fg-2">
                      {e.type === "status" && e.to_status
                        ? `Status → ${e.to_status}`
                        : e.type === "note"
                          ? "Note"
                          : e.type === "email"
                            ? "Email"
                            : e.type === "payment"
                              ? "Payment"
                              : e.type}
                    </span>
                    {e.message && <span className="block text-xs text-muted">{e.message}</span>}
                    {e.actor_email && <span className="block text-xs text-muted-2">{e.actor_email}</span>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {new Date(e.created_at).toLocaleString("en-AU")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <OrderActions orderId={order.id} status={order.status} />

          <section className="rounded-xl border border-line bg-surface p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-fg">Customer</h3>
            <p className="text-fg-2">{order.customer_name || "—"}</p>
            <p className="text-muted">{order.customer_email}</p>
            <Link
              href={`/admin/customers?q=${encodeURIComponent(order.customer_email)}`}
              className="mt-2 inline-block text-xs text-accent-2 hover:underline"
            >
              View customer
            </Link>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-fg">Shipping</h3>
            <address className="not-italic text-fg-2">
              {addr.line1}
              {addr.line2 ? <>, {addr.line2}</> : null}
              <br />
              {addr.suburb} {addr.state} {addr.postcode}
              <br />
              {addr.country ?? "AU"}
              {addr.phone ? (
                <>
                  <br />
                  {addr.phone}
                </>
              ) : null}
            </address>
            {order.tracking_number && (
              <p className="mt-2 text-xs text-muted">
                Tracking: <span className="font-mono text-fg-2">{order.tracking_number}</span>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-fg">Payment</h3>
            <p className="text-fg-2">{order.payment_method ?? "—"}</p>
            {order.payment_ref && (
              <p className="text-xs text-muted">
                Ref: <span className="font-mono">{order.payment_ref}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              Stock {order.stock_settled ? "decremented" : "reserved, awaiting payment"}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
