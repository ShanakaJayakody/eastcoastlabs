import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { formatAud } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import StatCard from "@/components/admin/StatCard";

export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  created_at: string;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireAdmin();
  const { email: raw } = await params;
  const email = decodeURIComponent(raw).toLowerCase();
  const db = adminDb();

  const [{ data: customer }, { data: orders }, { data: subscriber }, { data: waiting }] =
    await Promise.all([
      db.from("customers").select("*").eq("email", email).maybeSingle(),
      db
        .from("orders")
        .select("id, order_number, status, total_cents, created_at")
        .eq("customer_email", email)
        .order("created_at", { ascending: false }),
      db.from("subscribers").select("source, created_at").eq("email", email).maybeSingle(),
      db.from("stock_notifications").select("product_slug, notified").eq("email", email),
    ]);

  if (!customer) notFound();

  const rows = (orders ?? []) as OrderRow[];
  const c = customer as { name: string | null; orders_count: number; ltv_cents: number; first_order_at: string };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="rounded-md p-1 text-muted hover:text-fg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-fg">{c.name || email}</h2>
          <p className="text-xs text-muted">{email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime value" value={cents(c.ltv_cents)} sub="Paid orders only" />
        <StatCard label="Orders" value={String(c.orders_count)} />
        <StatCard
          label="First order"
          value={new Date(c.first_order_at).toLocaleDateString("en-AU")}
        />
        <StatCard
          label="Newsletter"
          value={subscriber ? "Subscribed" : "No"}
          sub={subscriber ? String(subscriber.source ?? "") : undefined}
        />
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Order history</h3>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr key={o.id} className="transition hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-accent hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(o.created_at).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3 text-right font-medium text-fg">{cents(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(waiting ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-fg">Back-in-stock requests</h3>
          <ul className="space-y-1 text-xs">
            {(waiting ?? []).map((w, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-fg-2">{w.product_slug as string}</span>
                <span className="text-muted">{w.notified ? "notified" : "waiting"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
