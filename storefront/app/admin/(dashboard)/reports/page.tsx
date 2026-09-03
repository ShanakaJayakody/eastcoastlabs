import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  parseRevenueScale,
  windowMeta,
  type RevenueScale,
  type WindowMeta,
} from "@/lib/admin/order-queries";
import { productPerformance, fulfilmentFunnel, emailPerformance, cohorts } from "@/lib/admin/reports";
import { formatAud } from "@/lib/format";
import PeriodNav from "@/components/admin/PeriodNav";
import Badge from "@/components/admin/Badge";
import { Bar } from "@/components/admin/Skeleton";

export const metadata: Metadata = { title: "Reports — ECL Admin" };
export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 1000) / 10}%` : "—");

const TABS = [
  { id: "products", label: "Products" },
  { id: "funnel", label: "Funnel" },
  { id: "email", label: "Email" },
  { id: "cohorts", label: "Cohorts" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scale?: string; at?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "products") as Tab;
  const meta = windowMeta(parseRevenueScale(sp.scale), sp.at);

  const linkFor = (patch: { tab?: Tab; scale?: RevenueScale; anchor?: string | null }) => {
    const params = new URLSearchParams();
    const nextTab = patch.tab ?? tab;
    if (nextTab !== "products") params.set("tab", nextTab);
    const scale = patch.scale ?? meta.scale;
    const anchor = "anchor" in patch ? patch.anchor : meta.isCurrent ? null : meta.anchor;
    if (scale !== "month") params.set("scale", scale);
    if (anchor) params.set("at", anchor);
    const qs = params.toString();
    return `/admin/reports${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="admin-stagger space-y-5 pb-10">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={linkFor({ tab: t.id })}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              t.id === tab
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-surface text-muted hover:text-fg-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Cohorts are a lifetime view — a period stepper would be meaningless. */}
      {tab !== "cohorts" && (
        <section className="admin-card rounded-xl p-4">
          <PeriodNav
            meta={meta}
            hrefFor={(scale, anchor) => linkFor({ scale, anchor })}
          />
        </section>
      )}

      <Suspense key={`${tab}:${meta.scale}:${meta.anchor}`} fallback={<ReportSkeleton />}>
        {tab === "products" && <ProductsReport meta={meta} />}
        {tab === "funnel" && <FunnelReport meta={meta} />}
        {tab === "email" && <EmailReport meta={meta} />}
        {tab === "cohorts" && <CohortsReport />}
      </Suspense>
    </div>
  );
}

/* -------------------------------- products -------------------------------- */

async function ProductsReport({ meta }: { meta: WindowMeta }) {
  const { rows, totals } = await productPerformance(meta);
  const sold = rows.filter((r) => r.unitsSold > 0 || r.refundedUnits > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Units sold" value={String(totals.unitsSold)} />
        <Figure label="Line revenue" value={cents(totals.revenueCents)} />
        <Figure label="Gross profit" value={cents(totals.profitCents)} />
        <Figure
          label="Products sold"
          value={`${sold.length} of ${rows.length}`}
        />
      </div>

      {totals.uncostedLines > 0 && (
        <Caveat>
          {totals.uncostedLines} sold line{totals.uncostedLines === 1 ? "" : "s"} in this period have
          no cost recorded, so their cost of goods counts as zero and every margin below is higher
          than it really is. Set a cost per vial on the product to fix it.
        </Caveat>
      )}

      <div className="admin-card overflow-hidden rounded-xl">
        {sold.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Nothing sold in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 text-right font-medium">Units</th>
                <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Profit</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Margin</th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Refunded</th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sold.map((row) => (
                <tr key={row.slug} className="transition hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${row.slug}`} className="text-fg-2 hover:text-accent">
                      {row.name}
                    </Link>
                    {row.uncostedLines > 0 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-warn">
                        no cost
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-2">{row.unitsSold}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-fg">
                    {cents(row.revenueCents)}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-fg-2 sm:table-cell">
                    {cents(row.profitCents)}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted sm:table-cell">
                    {row.marginPct == null ? "—" : `${row.marginPct}%`}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted md:table-cell">
                    {row.refundedUnits > 0 ? `${row.refundedUnits}u · ${cents(row.refundedCents)}` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    {row.onHand <= 0 ? (
                      <Badge tone={row.waiting > 0 ? "danger" : "warn"}>
                        {row.waiting > 0 ? `0 · ${row.waiting} waiting` : "0"}
                      </Badge>
                    ) : (
                      <span className="tabular-nums text-muted">{row.onHand}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        Revenue here is line revenue — shipping and order-level discounts are not attributed to a
        product, so these totals run slightly below the dashboard&apos;s.
      </p>
    </div>
  );
}

/* --------------------------------- funnel --------------------------------- */

async function FunnelReport({ meta }: { meta: WindowMeta }) {
  const f = await fulfilmentFunnel(meta);
  // One population, three states: of the orders raised in this window, how many
  // were paid and how many went out. Checkout emails are deliberately not the
  // first step — they are a different population and the ratio would exceed
  // 100% the moment a repeat customer ordered.
  const steps = [
    { label: "Orders raised", value: f.ordersRaised, of: f.ordersRaised },
    { label: "Paid", value: f.ordersPaid, of: f.ordersRaised },
    { label: "Shipped", value: f.ordersShipped, of: f.ordersPaid },
  ];

  return (
    <div className="space-y-3">
      <div className="admin-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-fg">Cart to dispatch</h3>
        <div className="mt-4 space-y-3">
          {steps.map((step, i) => {
            const width = steps[0].value > 0 ? (step.value / steps[0].value) * 100 : 0;
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-fg-2">{step.label}</span>
                  <span className="tabular-nums text-fg">
                    {step.value}
                    {i > 0 && (
                      <span className="ml-2 text-xs text-muted">{pct(step.value, step.of)} of previous</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                    style={{ width: `${Math.max(width, step.value > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label="Median time to ship"
          value={f.medianShipHours == null ? "—" : `${f.medianShipHours}h`}
          sub="from payment to dispatch"
        />
        <Figure
          label="Slowest"
          value={f.slowestShipHours == null ? "—" : `${f.slowestShipHours}h`}
          sub="worst case in this period"
        />
        <Figure label="Cancelled" value={String(f.ordersCancelled)} sub="unpaid or withdrawn" />
        <Figure label="Refunded" value={String(f.ordersRefunded)} sub="raised in this period" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure
          label="New checkout emails"
          value={String(f.newCheckoutEmails)}
          sub="first-time, this period"
        />
        <Figure
          label="Carts recovered"
          value={String(f.cartsRecovered)}
          sub="from those same records"
        />
        <Figure
          label="Awaiting dispatch now"
          value={String(f.awaitingDispatch)}
          sub="current, not period-scoped"
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-2">
        Checkout emails are counted once per address, ever — a returning shopper is
        counted in the month they first appeared, and anyone who buys without
        leaving an email never appears at all. That is why they sit beside the
        funnel rather than above it: they are not a denominator for it. Shipped
        counts orders that have a dispatch date, so one that shipped and was later
        refunded still counts as shipped.
      </p>
    </div>
  );
}

/* ---------------------------------- email --------------------------------- */

async function EmailReport({ meta }: { meta: WindowMeta }) {
  const { rows, totals, deliveryTrackingMissing, engagementTrackingMissing } =
    await emailPerformance(meta);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Sent" value={String(totals.sent)} />
        <Figure label="Delivered" value={pct(totals.delivered, totals.sent)} sub={`${totals.delivered} receipts`} />
        <Figure label="Opened" value={pct(totals.opened, totals.sent)} sub={`${totals.opened} events`} />
        <Figure
          label="Bounced or spam"
          value={pct(totals.bounced + totals.complained, totals.sent)}
          sub={`${totals.bounced + totals.complained} of ${totals.sent}`}
        />
      </div>

      {deliveryTrackingMissing && (
        <Caveat>
          Not one delivery receipt was recorded against {totals.sent} sends. That almost certainly
          means the <span className="font-mono">email.delivered</span> webhook is not subscribed in
          Resend rather than that nothing arrived — the rates above cannot be trusted until it is.
        </Caveat>
      )}
      {engagementTrackingMissing && !deliveryTrackingMissing && (
        <Caveat>
          No opens or clicks have ever been recorded. Resend tracks these only when open and click
          tracking are switched on for the domain, and the webhook subscribes to{" "}
          <span className="font-mono">email.opened</span> and{" "}
          <span className="font-mono">email.clicked</span>. Until then, treat 0% as &ldquo;not
          measured&rdquo;, not as &ldquo;nobody read it&rdquo;.
        </Caveat>
      )}

      <div className="admin-card overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">No email queued in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Template</th>
                <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Delivered</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Opened</th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Clicked</th>
                <th className="px-4 py-2.5 text-right font-medium">Problems</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const problems = row.bounced + row.complained + row.failed;
                return (
                  <tr key={row.template} className="transition hover:bg-surface-2/50">
                    <td className="px-4 py-3 font-mono text-xs text-fg-2">{row.template}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-fg">{row.sent}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted sm:table-cell">
                      {pct(row.delivered, row.sent)}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted sm:table-cell">
                      {pct(row.opened, row.sent)}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted md:table-cell">
                      {pct(row.clicked, row.sent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {problems > 0 ? (
                        <Badge tone="warn">{problems}</Badge>
                      ) : (
                        <span className="text-muted-2">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        Rates are against sends, not delivery receipts. Engagement events are matched to the send
        they belong to, so an open that arrives days later still counts against the right period.
      </p>
    </div>
  );
}

/* --------------------------------- cohorts -------------------------------- */

async function CohortsReport() {
  const rows = await cohorts();

  return (
    <div className="space-y-3">
      <div className="admin-card overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Nobody has ordered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">First ordered</th>
                <th className="px-4 py-2.5 text-right font-medium">Customers</th>
                <th className="px-4 py-2.5 text-right font-medium">Came back</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Average LTV</th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={row.month} className="transition hover:bg-surface-2/50">
                  <td className="px-4 py-3 text-fg-2">
                    {new Date(`${row.month}-01T12:00:00Z`).toLocaleDateString("en-AU", {
                      month: "long",
                      year: "numeric",
                    })}
                    {i === 0 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-2">
                        still young
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{row.customers}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-2">
                    {row.repeatCustomers}
                    <span className="ml-2 text-xs text-muted">{row.repeatPct}%</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-fg-2 sm:table-cell">
                    {cents(row.averageLtvCents)}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted md:table-cell">
                    {cents(row.totalLtvCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        Grouped by the month someone first ordered. The newest row always looks worst — its
        customers have had the least time to come back — so read it as incomplete rather than as a
        decline.
      </p>
    </div>
  );
}

/* -------------------------------- fragments ------------------------------- */

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-card rounded-xl p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-2">{sub}</div>}
    </div>
  );
}

function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-muted">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
      <span>{children}</span>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-card space-y-2 rounded-xl p-4">
            <Bar className="h-3 w-20" />
            <Bar className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="admin-card space-y-3 rounded-xl p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bar key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
