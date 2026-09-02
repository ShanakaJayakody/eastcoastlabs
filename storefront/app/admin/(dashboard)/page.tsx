import { Suspense } from "react";
import Link from "next/link";
import {
  PackageCheck,
  BellRing,
  Star,
  FlaskConical,
  Mail,
  AlertTriangle,
  Clock,
  ShoppingCart,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { orderMetrics, parseRevenueScale, revenueWindow } from "@/lib/admin/order-queries";
import { lowStockVariants } from "@/lib/admin/products";
import { attentionQueue, dailyCounts } from "@/lib/admin/attention";
import { queuedEmailCount } from "@/lib/admin/email";
import { listAbandonedCarts, abandonedCartCount } from "@/lib/admin/cart-recovery";
import { formatAud } from "@/lib/format";
import StatCard from "@/components/admin/StatCard";
import RevenueChart from "@/components/admin/RevenueChart";
import ActionQueue from "@/components/admin/ActionQueue";
import Badge from "@/components/admin/Badge";
import { Bar } from "@/components/admin/Skeleton";

export const dynamic = "force-dynamic";

interface AuditRow {
  actor_email: string;
  action: string;
  created_at: string;
}

const cents = (c: number) => formatAud(c / 100);

/**
 * The dashboard streams in four sibling sections.
 *
 * They are siblings on purpose: each Suspense boundary resolves independently,
 * so the work queue paints as soon as its own queries land instead of waiting
 * on the slowest read on the page. Shared catalogue data goes through
 * `listAllProducts`, which is request-cached, so parallel sections still cost
 * one database round trip between them.
 */
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ scale?: string; at?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-fg">
          Welcome back, {session.email.split("@")[0]}
        </h2>
        <p className="mt-1 text-sm text-muted">Here&apos;s what needs you today.</p>
      </div>

      <Suspense fallback={<QueueSkeleton />}>
        <AttentionSection />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueSection scale={sp.scale} at={sp.at} />
      </Suspense>

      <Suspense fallback={<TilesSkeleton />}>
        <TilesSection />
      </Suspense>

      <Suspense fallback={<PanelsSkeleton />}>
        <PanelsSection />
      </Suspense>
    </div>
  );
}

/* ---------------------------------- work --------------------------------- */

async function AttentionSection() {
  const queue = await attentionQueue();
  return <ActionQueue queue={queue} />;
}

/* --------------------------------- money --------------------------------- */

async function RevenueSection({ scale, at }: { scale?: string; at?: string }) {
  const window = await revenueWindow({ scale: parseRevenueScale(scale), anchor: at });
  return (
    <section className="admin-card overflow-hidden rounded-2xl">
      <RevenueChart initial={window} />
    </section>
  );
}

/* --------------------------------- tiles --------------------------------- */

async function TilesSection() {
  const [metrics, lowStock, abandonedCount, daily] = await Promise.all([
    orderMetrics(),
    lowStockVariants(),
    abandonedCartCount(1),
    dailyCounts(),
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Link href="/admin/orders?status=paid">
        <StatCard
          label="To fulfil"
          value={String(metrics.toFulfil)}
          sub="Paid orders awaiting dispatch · line shows daily intake"
          icon={PackageCheck}
          tone="accent"
          interactive
          series={daily.paidOrders.points}
          delta={daily.paidOrders.delta}
        />
      </Link>
      <Link href="/admin/orders?status=pending">
        <StatCard
          label="Awaiting payment"
          value={String(metrics.pendingPayment)}
          sub="Bank transfer not yet confirmed · line shows daily intake"
          icon={Clock}
          interactive
          series={daily.pendingOrders.points}
          delta={daily.pendingOrders.delta}
          invertDelta
        />
      </Link>
      {/* No sparkline: nothing records what stock levels were on past days. */}
      <Link href="/admin/products?low=1">
        <StatCard
          label="Low stock"
          value={String(lowStock.length)}
          sub="Variants at or below threshold"
          icon={AlertTriangle}
          tone={lowStock.length > 0 ? "warn" : "default"}
          interactive
        />
      </Link>
      <Link href="/admin/recovery">
        <StatCard
          label="Abandoned carts"
          value={String(abandonedCount)}
          sub="Idle 1h+ · line shows carts left daily"
          icon={ShoppingCart}
          interactive
          series={daily.abandonedCarts.points}
          delta={daily.abandonedCarts.delta}
          invertDelta
        />
      </Link>
    </div>
  );
}

/* -------------------------------- panels --------------------------------- */

async function PanelsSection() {
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
    lowStock,
    waitlist,
    subscribers,
    pendingReviews,
    coas,
    queuedEmails,
    abandonedCarts,
    events,
  ] = await Promise.all([
    lowStockVariants(),
    tableCount("stock_notifications"),
    tableCount("subscribers"),
    pendingReviewCount(),
    tableCount("coa_batches"),
    queuedEmailCount(),
    listAbandonedCarts(1, 5),
    recentActivity(),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Low stock detail */}
        <section className="admin-card rounded-xl lg:col-span-2">
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
                <div
                  key={v.sku}
                  className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
                >
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
          <section className="admin-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg">Pipeline</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <BellRing size={15} className="text-accent" /> Restock waitlist
                </span>
                <span className="font-medium tabular-nums text-fg">{waitlist}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-accent-2" /> Emails queued
                </span>
                <span className="font-medium tabular-nums text-fg">{queuedEmails}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-muted" /> Subscribers
                </span>
                <span className="font-medium tabular-nums text-fg">{subscribers}</span>
              </li>
            </ul>
          </section>

          <section className="admin-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg">Trust signals</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <FlaskConical size={15} className="text-accent" /> COAs published
                </span>
                <span className="font-medium tabular-nums text-fg">{coas}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Star size={15} className="text-warn" /> Reviews to moderate
                </span>
                <span className="font-medium tabular-nums text-fg">{pendingReviews}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {abandonedCarts.length > 0 && (
        <section className="admin-card rounded-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Abandoned carts</h3>
            <Link href="/admin/recovery" className="text-xs text-accent-2 hover:underline">
              Recovery centre
            </Link>
          </div>
          <div className="divide-y divide-line">
            {abandonedCarts.map((c) => (
              <div
                key={c.email}
                className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
              >
                <div>
                  <span className="text-fg-2">{c.email}</span>
                  <span className="block text-xs text-muted">
                    Idle since {new Date(c.updated_at).toLocaleString("en-AU")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium tabular-nums text-fg">{cents(c.subtotal_cents)}</span>
                  <span className="block text-xs text-muted-2">
                    {c.reminder_sent_at ? "reminder sent" : "not yet reminded"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="admin-card rounded-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Recent activity</h3>
        </div>
        <div className="divide-y divide-line">
          {events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No admin activity yet.</p>
          ) : (
            events.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
              >
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

/* ------------------------------- skeletons -------------------------------- */

function QueueSkeleton() {
  return (
    <section className="admin-card rounded-2xl">
      <div className="border-b border-line px-4 py-3">
        <Bar className="h-4 w-24" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bar className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Bar className="h-3 w-48" />
              <Bar className="h-2.5 w-32" />
            </div>
            <Bar className="h-7 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartSkeleton() {
  return (
    <section className="admin-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Bar className="h-3 w-16" />
          <Bar className="h-8 w-40" />
          <Bar className="h-3 w-32" />
        </div>
        <Bar className="h-9 w-48 rounded-xl" />
      </div>
      <Bar className="mt-6 h-[240px] w-full rounded-lg" />
    </section>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="admin-card space-y-3 rounded-xl p-4">
          <Bar className="h-3 w-20" />
          <Bar className="h-7 w-12" />
          <Bar className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

function PanelsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="admin-card space-y-3 rounded-xl p-4 lg:col-span-2">
        <Bar className="h-4 w-24" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="admin-card space-y-3 rounded-xl p-4">
            <Bar className="h-4 w-24" />
            <Bar className="h-5 w-full" />
            <Bar className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
