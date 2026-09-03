import { Suspense } from "react";
import AuditTrail from "@/components/admin/AuditTrail";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { formatAud } from "@/lib/format";
import { loadPerson, deriveSequenceState, buildJourney } from "@/lib/admin/customer-360";
import StatusBadge from "@/components/admin/StatusBadge";
import StatCard from "@/components/admin/StatCard";
import Badge from "@/components/admin/Badge";
import JourneyTimeline from "@/components/admin/JourneyTimeline";
import type { StepperStep } from "@/components/admin/SequenceStepper";
import {
  SequenceCard,
  EmailRowAction,
  MarketingToggle,
  NoteComposer,
  type SequenceCardData,
} from "@/components/admin/CustomerControls";

export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireAdmin();
  const { email: raw } = await params;
  const email = decodeURIComponent(raw).toLowerCase();

  const person = await loadPerson(email);
  // Keyed on the email, not on a customers row: subscribers and cart abandoners
  // are people worth managing too, and they never appear in the customers view.
  if (person.summary.unknown) notFound();

  const [sequences, journey] = await Promise.all([
    deriveSequenceState(person),
    buildJourney(person, (row) =>
      row.status === "queued" || row.status === "failed" ? (
        <EmailRowAction id={row.id} email={email} status={row.status as "queued" | "failed"} />
      ) : null,
    ),
  ]);

  const { summary, orders, cart, notes, waitlist } = person;
  const suppressed = summary.unsubscribedAt !== null;

  const cards: SequenceCardData[] = sequences.map((s) => {
    const next = s.stages.find((st) => st.state === "next");
    const steps: StepperStep[] = s.stages.map((st) => ({
      label: st.label,
      state: st.state,
      at: st.at,
      etaMs: st.etaMs,
      detail: st.outboxStatus === "failed" ? "send failed" : null,
    }));
    return {
      id: s.id,
      label: s.label,
      active: s.active,
      paused: s.paused,
      context: s.context,
      steps,
      nextStage: next?.stage ?? null,
      nextLabel: next?.label ?? null,
    };
  });

  return (
    <div className="admin-stagger space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/customers" className="rounded-md p-1 text-muted hover:text-fg">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-fg">{summary.name || email}</h2>
            <p className="text-xs text-muted">{email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!summary.hasOrders && <Badge tone="info">lead</Badge>}
            {suppressed && <Badge tone="warn">unsubscribed</Badge>}
            {summary.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </div>
        <MarketingToggle email={email} suppressed={suppressed} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime value" value={cents(summary.ltvCents)} sub="Paid orders only" />
        <StatCard label="Orders" value={String(summary.ordersCount)} />
        <StatCard
          label="First order"
          value={
            summary.firstOrderAt
              ? new Date(summary.firstOrderAt).toLocaleDateString("en-AU")
              : "—"
          }
        />
        <StatCard
          label="Touches sent"
          value={String(person.outbox.filter((o) => o.status === "sent").length)}
          sub={`${person.outbox.length} total in outbox`}
        />
      </div>

      {/* Live sequences — the heart of the page */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-fg">Sequences</h3>
        {cards.length === 0 ? (
          <p className="admin-card rounded-xl px-4 py-6 text-sm text-muted">
            No automated sequence is running for this person right now.
          </p>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <SequenceCard key={`${c.id}-${c.label}`} email={email} data={c} />
            ))}
          </div>
        )}
      </section>

      {cart && cart.status === "active" && (
        <section className="admin-card rounded-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ShoppingBag size={15} className="text-accent" /> Cart in progress
            </h3>
            <span className="text-sm font-medium tabular-nums text-fg">
              {cents(cart.subtotal_cents)}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {cart.cart.map((line, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-fg-2">
                  {line.name}
                  {line.variantLabel ? (
                    <span className="text-muted"> · {line.variantLabel}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted">×{line.quantity}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted-2">
            Last activity {new Date(cart.updated_at).toLocaleString("en-AU")}
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="admin-card rounded-xl lg:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Journey</h3>
          </div>
          <div className="px-4 py-3">
            <JourneyTimeline items={journey} emptyMessage="No touches or events yet." />
          </div>
        </section>

        <div className="space-y-6">
          <section className="admin-card rounded-xl p-4">
            <h3 className="mb-3 text-sm font-semibold text-fg">Notes</h3>
            <NoteComposer email={email} />
            <ul className="mt-3 space-y-2">
              {notes.length === 0 ? (
                <li className="text-xs text-muted">No notes yet.</li>
              ) : (
                notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-line bg-ink-2/50 p-2.5 text-xs">
                    <p className="text-fg-2">{n.note}</p>
                    <p className="mt-1 text-muted-2">
                      {n.actor_email} · {new Date(n.created_at).toLocaleDateString("en-AU")}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="admin-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-fg">Marketing</h3>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className={suppressed ? "text-warn" : "text-fg-2"}>
                  {suppressed ? "Unsubscribed" : summary.subscribed ? "Subscribed" : "Not subscribed"}
                </span>
              </li>
              {summary.subscriberSource && (
                <li className="flex justify-between">
                  <span className="text-muted">Source</span>
                  <span className="text-fg-2">{summary.subscriberSource}</span>
                </li>
              )}
            </ul>
            {waitlist.length > 0 && (
              <>
                <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  Back-in-stock
                </h4>
                <ul className="space-y-1 text-xs">
                  {waitlist.map((w, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-fg-2">{w.product_slug}</span>
                      <span className="text-muted">{w.notified ? "notified" : "waiting"}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>

      {orders.length > 0 && (
        <section className="admin-card rounded-xl">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Order history</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="transition hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-accent hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(o.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-fg">
                    {cents(o.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {/* Own boundary: the trail must not add its latency to the page's
          first byte — the rest of this view does not depend on it. */}
      <Suspense fallback={null}>
        <AuditTrail entityType="customer" entityId={email} />
      </Suspense>
    </div>
  );
}
