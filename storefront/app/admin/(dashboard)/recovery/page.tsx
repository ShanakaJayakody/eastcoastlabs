import Link from "next/link";
import { DollarSign, Percent, ShoppingCart, Send } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { formatAud } from "@/lib/format";
import { listCartsFor, recoveryMetrics } from "@/lib/admin/cart-recovery";
import { CART_STAGES, cartRelatedId, deriveStages } from "@/lib/admin/sequences";
import { adminDb } from "@/lib/admin/db";
import { pausedEmailsFor } from "@/lib/admin/overrides";
import StatCard from "@/components/admin/StatCard";
import SequenceStepper, { type StepperStep } from "@/components/admin/SequenceStepper";
import Badge from "@/components/admin/Badge";
import { SequenceCard, type SequenceCardData } from "@/components/admin/CustomerControls";

export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

type Tab = "active" | "recovered" | "expired";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "In recovery" },
  { id: "recovered", label: "Recovered" },
  { id: "expired", label: "Expired" },
];

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.some((t) => t.id === rawTab) ? rawTab : "active") as Tab;

  const [metrics, carts, paused] = await Promise.all([
    recoveryMetrics(30),
    listCartsFor(tab, 50),
    pausedEmailsFor("cart_recovery"),
  ]);

  // One outbox read for the whole page: the steppers need to know which touches
  // actually went out, and per-row queries would mean N round trips.
  const emails = carts.map((c) => c.email);
  const { data: outboxRows } = emails.length
    ? await adminDb()
        .from("email_outbox")
        .select("id, template, related_id, status, created_at, sent_at")
        .in("to_email", emails)
        .in("template", ["abandoned_cart", "abandoned_cart_2", "abandoned_cart_3"])
    : { data: [] };

  const byEmail = new Map<string, typeof outboxRows>();
  for (const row of outboxRows ?? []) {
    const key = (row as { related_id: string | null }).related_id?.split(":")[0] ?? "";
    const list = byEmail.get(key) ?? [];
    list.push(row);
    byEmail.set(key, list);
  }

  return (
    <div className="admin-stagger space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-fg">Cart recovery</h2>
        <p className="mt-1 text-sm text-muted">
          Three touches at +1h, +24h and +72h. Carts idle past a week stop receiving anything.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active carts"
          value={String(metrics.activeCarts)}
          sub="Idle 1h or more"
          icon={ShoppingCart}
          tone="accent"
        />
        <StatCard
          label="In sequence"
          value={String(metrics.inSequence)}
          sub="At least one touch sent"
          icon={Send}
        />
        <StatCard
          label="Recovery rate"
          value={metrics.recoveryRatePct === null ? "—" : `${metrics.recoveryRatePct}%`}
          sub="Carts captured in last 30d"
          icon={Percent}
        />
        <StatCard
          label="Revenue recovered"
          value={cents(metrics.revenueRecoveredCents)}
          sub={`${metrics.recovered30d} cart(s) converted · 30d`}
          icon={DollarSign}
          tone="accent"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "active" ? "/admin/recovery" : `/admin/recovery?tab=${t.id}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              t.id === tab
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-surface text-muted hover:border-line-2 hover:text-fg-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {carts.length === 0 ? (
        <p className="admin-card rounded-xl px-4 py-10 text-center text-sm text-muted">
          {tab === "active"
            ? "No carts are in recovery right now."
            : tab === "recovered"
              ? "No recovered carts in this window."
              : "No expired carts — nothing aged out untouched."}
        </p>
      ) : (
        <div className="space-y-3">
          {carts.map((cart) => {
            const outbox = (byEmail.get(cart.email) ?? []) as {
              id: string;
              template: string;
              related_id: string | null;
              status: string;
              created_at: string;
              sent_at: string | null;
            }[];
            const stages = deriveStages(
              CART_STAGES,
              cart.updated_at,
              (n) => cartRelatedId(cart.email, n, cart.updated_at),
              outbox,
            );
            const steps: StepperStep[] = stages.map((s) => ({
              label: s.label,
              state: s.state,
              at: s.at,
              etaMs: s.etaMs,
            }));
            const next = stages.find((s) => s.state === "next");
            const lines = cart.cart ?? [];

            if (tab !== "active") {
              return (
                <div key={cart.email} className="admin-card rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(cart.email)}`}
                        className="text-sm text-fg-2 hover:text-accent"
                      >
                        {cart.email}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {lines.length} line(s) ·{" "}
                        {new Date(cart.updated_at).toLocaleString("en-AU")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {tab === "recovered" && cart.recovered_order_id && (
                        <Link
                          href={`/admin/orders/${cart.recovered_order_id}`}
                          className="text-xs text-accent-2 hover:underline"
                        >
                          View order
                        </Link>
                      )}
                      {tab === "expired" && <Badge tone="neutral">aged out</Badge>}
                      <span className="text-sm font-medium tabular-nums text-fg">
                        {cents(cart.subtotal_cents)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <SequenceStepper steps={steps} compact />
                  </div>
                </div>
              );
            }

            const data: SequenceCardData = {
              id: "cart_recovery",
              label: cart.email,
              active: Boolean(next),
              paused: paused.has(cart.email),
              context: `${lines.length} line(s) · ${cents(cart.subtotal_cents)} · idle since ${new Date(
                cart.updated_at,
              ).toLocaleString("en-AU")}`,
              steps,
              nextStage: next?.stage ?? null,
              nextLabel: next?.label ?? null,
            };
            return <SequenceCard key={cart.email} email={cart.email} data={data} />;
          })}
        </div>
      )}
    </div>
  );
}
