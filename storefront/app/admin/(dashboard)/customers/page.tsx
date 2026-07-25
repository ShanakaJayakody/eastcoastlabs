import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { formatAud } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CustomerRow {
  email: string;
  name: string | null;
  orders_count: number;
  ltv_cents: number;
  first_order_at: string;
  last_order_at: string;
}

const cents = (c: number) => formatAud(c / 100);

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;

  let query = adminDb().from("customers").select("*").order("ltv_cents", { ascending: false }).limit(100);
  if (q?.trim()) query = query.ilike("email", `%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as CustomerRow[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{rows.length} customers by lifetime value</p>
        <form action="/admin/customers" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search email"
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
          />
          <button className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">
            No customers yet — they appear here after their first order.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Orders</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Last order</th>
                <th className="px-4 py-2.5 text-right font-medium">Lifetime value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.email} className="transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <span className="text-fg-2">{c.name || "—"}</span>
                    <span className="block text-xs text-muted">{c.email}</span>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{c.orders_count}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {new Date(c.last_order_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-fg">{cents(c.ltv_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        <Link href="/admin/orders" className="text-accent-2 hover:underline">
          View all orders
        </Link>
      </p>
    </div>
  );
}
