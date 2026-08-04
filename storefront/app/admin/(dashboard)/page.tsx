import Link from "next/link";
import { DollarSign, PackageCheck, BellRing, Star, FlaskConical, Mail, AlertTriangle, Clock, ShoppingCart, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { orderMetrics } from "@/lib/admin/order-queries";
import { lowStockVariants } from "@/lib/admin/products";
import { queuedEmailCount } from "@/lib/admin/email";
import { listAbandonedCarts, abandonedCartCount } from "@/lib/admin/cart-recovery";
import { formatAud } from "@/lib/format";
import StatCard from "@/components/admin/StatCard";
import { profitSince } from "@/lib/admin/costs";
import Badge from "@/components/admin/Badge";

export const dynamic = "force-dynamic";

interface AuditRow {
  actor_email: string;
  action: string;
  created_at: string;
}

const cents = (c: number) => formatAud(c / 100);

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const admin = supabaseAdmin();

  const tableCount = async (table: string): Promise<number> => {
    if (!admin) return 0;
    const { count } = await admin.from(table).select("*", { count: "exact", head: true });
    return count ?? 0;
  };
  const pendingReviewCount = async (): Promise<number> => {
    if (!admin) return 0;
    const { count } = await admin
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  };

  // Every dashboard read fires in one batch — the audit feed used to run after
  // the others, adding a whole extra database round trip to first paint.
  const recentActivity = async (): Promise<AuditRow[]> => {
    if (!admin) return [];
    const { data } = await admin
      .from("admin_audit_log")
      .select("actor_email, action, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    return (data ?? []) as AuditRow[];
  };

  const [
    metrics,
    lowStock,
    waitlist,
    subscribers,
    pendingReviews,
    coas,
    queuedEmails,
    abandonedCount,
    abandonedCarts,
    events,
    profitToday,
    profit30d,
  ] = await Promise.all([
    orderMetrics(),
    lowStockVariants(),
    tableCount("stock_notifications"),
    tableCount("subscribers"),
    pendingReviewCount(),
    tableCount("coa_batches"),
    queuedEmailCount(),
    abandonedCartCount(1),
    listAbandonedCarts(1, 5),
    recentActivity(),
    profitSince(0),
    profitSince(30),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-fg">
          Welcome back, {session.email.split("@")[0]}
        </h2>
        <p className="mt-1 text-sm text-muted">Here&apos;s what needs you today.</p>
      </div>

      {/* Revenue + fulfilment */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Revenue today"
          value={cents(metrics.revenueToday)}
          sub={`${cents(metrics.revenue7d)} last 7d · ${cents(metrics.revenue30d)} last 30d`}
          icon={DollarSign}
        />
        <StatCard
          label="Gross profit today"
          value={profitToday.cogsCents > 0 || profitToday.revenueCents > 0 ? cents(profitToday.profitCents) : "—"}
          sub={
            profit30d.revenueCents > 0
              ? `${cents(profit30d.profitCents)} last 30d${profit30d.marginPct != null ? ` · ${profit30d.marginPct}% margin` : ""}${profit30d.uncostedLines > 0 ? ` · ${profit30d.uncostedLines} line(s) uncosted` : ""}`
              : "Enter a cost per vial to track margin"
          }
          icon={TrendingUp}
        />
        <Link href="/admin/orders?status=paid">
          <StatCard
            label="To fulfil"
            value={String(metrics.toFulfil)}
            sub="Paid orders awaiting dispatch"
            icon={PackageCheck}
          />
        </Link>
        <Link href="/admin/orders?status=pending">
          <StatCard
            label="Awaiting payment"
            value={String(metrics.pendingPayment)}
            sub="Bank transfer not yet confirmed"
            icon={Clock}
          />
        </Link>
        <Link href="/admin/products?low=1">
          <StatCard
            label="Low stock"
            value={String(lowStock.length)}
            sub="Variants at or below threshold"
            icon={AlertTriangle}
          />
        </Link>
        <StatCard
          label="Abandoned carts"
          value={String(abandonedCount)}
          sub="Idle 1h+ · recovery email queued hourly"
          icon={ShoppingCart}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Low stock detail */}
        <section className="rounded-xl border border-line bg-surface lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Low stock</h3>
            <Link href="/admin/products?low=1" className="text-xs text-accent-2 hover:underline">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-line">
            {lowStock.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Everything is above its threshold.</p>
            ) : (
              lowStock.slice(0, 8).map((v) => (
                <div key={v.sku} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <Link href={`/admin/products/${v.slug}`} className="text-fg-2 hover:text-accent">
                      {v.productName}
                    </Link>
                    <span className="block text-xs text-muted">
                      {v.label} · <span className="font-mono">{v.sku}</span>
                    </span>
                  </div>
                  <Badge tone={v.available <= 0 ? "danger" : "warn"}>
                    {v.available} left (min {v.threshold})
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Growth + trust */}
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-semibold text-fg">Pipeline</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <BellRing size={15} className="text-accent" /> Restock waitlist
                </span>
                <span className="font-medium text-fg">{waitlist}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-accent-2" /> Emails queued
                </span>
                <span className="font-medium text-fg">{queuedEmails}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-muted" /> Subscribers
                </span>
                <span className="font-medium text-fg">{subscribers}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-semibold text-fg">Trust signals</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <FlaskConical size={15} className="text-accent" /> COAs published
                </span>
                <span className="font-medium text-fg">{coas}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Star size={15} className="text-warn" /> Reviews to moderate
                </span>
                <span className="font-medium text-fg">{pendingReviews}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {abandonedCarts.length > 0 && (
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Abandoned carts</h3>
            <span className="text-xs text-muted">
              {abandonedCarts.filter((c) => c.reminder_sent_at).length} reminder(s) sent
            </span>
          </div>
          <div className="divide-y divide-line">
            {abandonedCarts.map((c) => (
              <div key={c.email} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="text-fg-2">{c.email}</span>
                  <span className="block text-xs text-muted">
                    Idle since {new Date(c.updated_at).toLocaleString("en-AU")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-fg">{cents(c.subtotal_cents)}</span>
                  <span className="block text-xs text-muted-2">
                    {c.reminder_sent_at ? "reminder sent" : "not yet reminded"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Recent activity</h3>
        </div>
        <div className="divide-y divide-line">
          {events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No admin activity yet.</p>
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone="info">{e.action}</Badge>
                  <span className="text-fg-2">{e.actor_email}</span>
                </div>
                <span className="text-xs text-muted">
                  {new Date(e.created_at).toLocaleString("en-AU")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
