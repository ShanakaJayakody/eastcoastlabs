import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders } from "@/lib/admin/order-queries";
import type { OrderStatus } from "@/lib/admin/orders";
import { formatAud } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

const STATUSES: (OrderStatus | "all")[] = [
  "all",
  "pending",
  "paid",
  "processing",
  "shipped",
  "completed",
  "refunded",
  "cancelled",
];

const cents = (c: number) => formatAud(c / 100);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (STATUSES.includes(sp.status as OrderStatus) ? sp.status : "all") as OrderStatus | "all";
  const search = sp.q ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = 25;

  const { rows, total } = await listOrders({ status, search, limit, offset: (page - 1) * limit });
  const pages = Math.max(1, Math.ceil(total / limit));

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(search ? { q: search } : {}) });
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total} order{total === 1 ? "" : "s"}
          {status !== "all" && ` · ${status}`}
        </p>
        <form action="/admin/orders" className="flex gap-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={search}
            placeholder="Order #, email, name"
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
          />
          <button className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg">
            Search
          </button>
        </form>
      </div>

      {/* status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
              status === s
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-surface text-muted hover:text-fg-2"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-fg">No orders yet.</p>
            <p className="mt-1 text-sm text-muted">
              Orders placed on the storefront appear here the moment they&apos;re submitted.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Items</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Placed</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} className="transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-accent hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-fg-2">{o.customer_name || "—"}</span>
                    <span className="block text-xs text-muted">{o.customer_email}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-fg-2 sm:table-cell">{o.item_count}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {new Date(o.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-fg">{cents(o.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: String(page - 1) })} className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: String(page + 1) })} className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
