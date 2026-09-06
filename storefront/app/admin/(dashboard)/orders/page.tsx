import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listOrders,
  orderStatusCounts,
  parseOrderSort,
  sydneyDayBoundary,
  type OrderFilter,
} from "@/lib/admin/order-queries";
import { reinstatabilityFor } from "@/lib/admin/orders";
import OrdersTable from "@/components/admin/OrdersTable";
import OrdersFilters from "@/components/admin/OrdersFilters";

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
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
    discount?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.q ?? "";
  // Only echo a date back to the UI if it is one the query will actually apply,
  // so the chip can never advertise a filter that silently did nothing.
  const from = sydneyDayBoundary(sp.from) ? (sp.from as string) : "";
  const to = sydneyDayBoundary(sp.to, true) ? (sp.to as string) : "";
  const discount = sp.discount?.trim() ?? "";
  const sort = parseOrderSort(sp.sort);
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  // Default view is the fulfilment queue — searching implies "look everywhere".
  const status: OrderFilter = VALID.has(sp.status as OrderFilter)
    ? (sp.status as OrderFilter)
    : search
      ? "all"
      : "to_fulfil";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = 25;

  const [{ rows, total }, counts] = await Promise.all([
    listOrders({ status, search, limit, offset: (page - 1) * limit, from, to, sort, dir, discount }),
    orderStatusCounts(),
  ]);
  const pages = Math.max(1, Math.ceil(total / limit));

  // Only the cancelled view pays for this: a reinstate is the one action those
  // rows offer, and whether it can succeed is the first thing an operator wants
  // to know without opening each order.
  const cancelledIds = rows.filter((r) => r.status === "cancelled").map((r) => r.id);
  const reinstatable = cancelledIds.length
    ? Object.fromEntries(
        [...(await reinstatabilityFor(cancelledIds))].map(([id, v]) => [
          id,
          { recoverable: v.recoverable, short: v.short.length },
        ]),
      )
    : undefined;

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(status !== "to_fulfil" ? { status } : {}),
      ...(search ? { q: search } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(discount ? { discount } : {}),
      ...(sort !== "created_at" || dir !== "desc" ? { sort, dir } : {}),
    });
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return `/admin/orders?${p.toString()}`;
  };

  // Tabs keep the date range and search — switching status is a narrowing of
  // the same question, not a new one.
  const tabHref = (key: OrderFilter) => {
    const p = new URLSearchParams({
      ...(key !== "to_fulfil" ? { status: key } : {}),
      ...(search ? { q: search } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(discount ? { discount } : {}),
    });
    const qs = p.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  const exportHref = (() => {
    const p = new URLSearchParams({ status });
    if (search) p.set("q", search);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (discount) p.set("discount", discount);
    p.set("sort", sort);
    p.set("dir", dir);
    return `/admin/orders/export?${p.toString()}`;
  })();

  const dateLabel = from || to ? ` · ${from || "start"} to ${to || "today"}` : "";

  const activeLabel = TABS.find((t) => t.key === status)?.label ?? "Orders";

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            {total} order{total === 1 ? "" : "s"} · {activeLabel.toLowerCase()}
            {dateLabel}
          </p>
          {discount && (
            <Link
              href={(() => {
                const p = new URLSearchParams();
                if (status !== "to_fulfil") p.set("status", status);
                if (search) p.set("q", search);
                if (from) p.set("from", from);
                if (to) p.set("to", to);
                const qs = p.toString();
                return `/admin/orders${qs ? `?${qs}` : ""}`;
              })()}
              title="Remove this filter"
              className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-mono text-accent hover:border-accent"
            >
              {discount} ×
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders/new"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:brightness-95"
          >
            New order
          </Link>
          <OrdersFilters search={search} from={from} to={to} exportHref={exportHref} />
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
              href={tabHref(t.key)}
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
        <OrdersTable
          rows={rows}
          reinstatable={reinstatable}
          sort={sort}
          dir={dir}
          query={{
            ...(status !== "to_fulfil" ? { status } : {}),
            ...(search ? { q: search } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(discount ? { discount } : {}),
          }}
        />
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
