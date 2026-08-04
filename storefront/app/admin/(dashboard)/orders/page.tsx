import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders, orderStatusCounts, type OrderFilter } from "@/lib/admin/order-queries";
import OrdersTable from "@/components/admin/OrdersTable";

export const dynamic = "force-dynamic";

/** Tabs in operator order: the work first, the archive last. */
const TABS: { key: OrderFilter; label: string }[] = [
  { key: "to_fulfil", label: "To fulfil" },
  { key: "pending", label: "Awaiting payment" },
  { key: "shipped", label: "Shipped" },
  { key: "completed", label: "Completed" },
  { key: "refunded", label: "Refunded" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const VALID = new Set(TABS.map((t) => t.key));

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.q ?? "";
  // Default view is the fulfilment queue — searching implies "look everywhere".
  const status: OrderFilter = VALID.has(sp.status as OrderFilter)
    ? (sp.status as OrderFilter)
    : search
      ? "all"
      : "to_fulfil";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = 25;

  const [{ rows, total }, counts] = await Promise.all([
    listOrders({ status, search, limit, offset: (page - 1) * limit }),
    orderStatusCounts(),
  ]);
  const pages = Math.max(1, Math.ceil(total / limit));

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(status !== "to_fulfil" ? { status } : {}),
      ...(search ? { q: search } : {}),
    });
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return `/admin/orders?${p.toString()}`;
  };

  const activeLabel = TABS.find((t) => t.key === status)?.label ?? "Orders";

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total} order{total === 1 ? "" : "s"} · {activeLabel.toLowerCase()}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders/new"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:brightness-95"
          >
            New order
          </Link>
          <form action="/admin/orders" className="flex gap-2">
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
      </div>

      {/* status tabs with live counts */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n = counts[t.key] ?? 0;
          const active = status === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "to_fulfil" ? "/admin/orders" : `/admin/orders?status=${t.key}`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-line bg-surface text-muted hover:text-fg-2"
              }`}
            >
              {t.label}
              {n > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                    active ? "bg-accent/20" : "bg-line text-fg-2"
                  }`}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-fg">
            {status === "to_fulfil" ? "Nothing to fulfil — you're all caught up." : "No orders here."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {status === "to_fulfil"
              ? "Paid orders appear here the moment payment is confirmed."
              : "Try another filter or clear your search."}
          </p>
        </div>
      ) : (
        <OrdersTable rows={rows} />
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: String(page - 1) })}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={href({ page: String(page + 1) })}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
