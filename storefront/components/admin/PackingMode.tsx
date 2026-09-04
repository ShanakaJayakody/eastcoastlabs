"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, CheckCircle2, Printer, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import { advanceStatus } from "@/app/admin/(dashboard)/orders/actions";
import ConfirmModal from "./ConfirmModal";

const cents = (c: number) => formatAud(c / 100);

export interface PackItem {
  id: string;
  productName: string | null;
  variantLabel: string | null;
  sku: string | null;
  qty: number;
  refundedQty: number;
  lineTotalCents: number;
}

export interface PackOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string;
  address: Record<string, string | null> | null;
  totalCents: number;
  notes: string | null;
  items: PackItem[];
}

/** Address lines in the order Australia Post expects them. */
function addressLines(address: Record<string, string | null> | null): string[] {
  if (!address) return [];
  const line = (...keys: string[]) =>
    keys
      .map((k) => address[k])
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(" ");
  return [
    line("name"),
    line("line1"),
    line("line2"),
    line("city", "state", "postcode"),
    line("country"),
  ].filter(Boolean);
}

/**
 * One order, one screen, both hands free.
 *
 * The checklist is deliberately local and unsaved: it exists to stop you losing
 * your place in a six-line order, not to be a record. The only thing that
 * persists is marking the order shipped.
 */
export default function PackingMode({
  order,
  nextId,
  position,
  total,
  positionUnknown = false,
}: {
  order: PackOrder;
  nextId: string | null;
  /** 1-based place in the queue, or 0 if this order is not in the window. */
  position: number;
  total: number;
  /** The backlog is deeper than the queue window, so `position` is unknown. */
  positionUnknown?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Moving to the next order is a soft navigation on the same route, so React
  // reuses this component and the tick marks — and the tracking number — would
  // carry over onto a different parcel. Reset when the order changes.
  const [shownOrderId, setShownOrderId] = useState(order.id);
  if (shownOrderId !== order.id) {
    setShownOrderId(order.id);
    setPacked(new Set());
    setTracking("");
    setConfirming(false);
  }

  const shippable = order.items.filter((i) => i.qty - i.refundedQty > 0);
  const allPacked = shippable.length > 0 && shippable.every((i) => packed.has(i.id));
  const lines = addressLines(order.address);

  const toggle = (id: string) =>
    setPacked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ship = () =>
    start(async () => {
      const result = await advanceStatus(order.id, "shipped", tracking.trim() || undefined);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't mark it shipped");
        return;
      }
      toast.success(`#${order.orderNumber} shipped — dispatch email queued`);
      setConfirming(false);
      // Straight to the next one; the queue is the point of this screen.
      router.push(nextId ? `/admin/orders/${nextId}/pack` : "/admin/orders");
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">
            Packing #{order.orderNumber}
          </h2>
          <p className="text-sm text-muted">
            {position > 0
              ? `${position} of ${total} to pack`
              : positionUnknown
                ? `${total} to pack`
                : "No longer in the packing queue"}
            {" · "}
            {order.customerName || order.customerEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/orders/${order.id}/slip`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
          >
            <Printer size={15} /> Slip
          </a>
          <Link
            href={`/admin/orders/${order.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-2 text-sm text-muted transition hover:text-fg"
          >
            <X size={15} /> Exit
          </Link>
        </div>
      </div>

      {/* Items — big tap targets, because this is done standing at a bench. */}
      <section className="admin-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">
            {packed.size} of {shippable.length} picked
          </h3>
          {packed.size > 0 && (
            <button
              type="button"
              onClick={() => setPacked(new Set())}
              className="text-xs text-muted transition hover:text-fg-2"
            >
              Reset
            </button>
          )}
        </div>
        <div className="divide-y divide-line">
          {shippable.map((item) => {
            const isPacked = packed.has(item.id);
            const qty = item.qty - item.refundedQty;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={isPacked}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-surface-2/50"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
                    isPacked
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line-2 text-transparent"
                  }`}
                >
                  <Check size={16} />
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold tabular-nums text-fg">
                  {qty}
                </span>
                <span className={`min-w-0 flex-1 ${isPacked ? "opacity-40" : ""}`}>
                  <span className="block truncate text-sm font-medium text-fg">
                    {item.productName}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.variantLabel}
                    {item.sku && <span className="font-mono"> · {item.sku}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {cents(item.lineTotalCents)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {order.notes && (
        <section className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-fg-2">
          <span className="text-xs font-medium uppercase tracking-wide text-warn">Order note</span>
          <p className="mt-1">{order.notes}</p>
        </section>
      )}

      <section className="admin-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-fg">Ship to</h3>
        {lines.length > 0 ? (
          <address className="mt-2 not-italic text-sm leading-relaxed text-fg-2">
            {lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        ) : (
          <p className="mt-2 text-sm text-muted">No shipping address on this order.</p>
        )}
        <p className="mt-2 text-xs text-muted">{order.customerEmail}</p>
      </section>

      <section className="admin-card rounded-xl p-4">
        <label htmlFor="tracking" className="text-sm font-medium text-fg">
          Tracking number
        </label>
        <p className="mt-0.5 text-xs text-muted">
          Optional, but it goes in the dispatch email — adding it here saves answering
          &ldquo;where is my order&rdquo; later.
        </p>
        <input
          id="tracking"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="e.g. 33ABC123456789"
          className="mt-2 w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-fg outline-none focus:border-accent"
        />
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition disabled:opacity-50 ${
            allPacked
              ? "bg-accent text-accent-ink hover:brightness-95"
              : "border border-line-2 bg-surface text-fg-2 hover:text-fg"
          }`}
        >
          <CheckCircle2 size={17} />
          {pending ? "Working…" : allPacked ? "Packed — mark shipped" : "Mark shipped anyway"}
        </button>
        {!allPacked && shippable.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted-2">
            {shippable.length - packed.size} item
            {shippable.length - packed.size === 1 ? "" : "s"} still to pick
          </p>
        )}
      </div>

      {nextId && (
        <Link
          href={`/admin/orders/${nextId}/pack`}
          className="flex items-center justify-center gap-1.5 py-2 text-xs text-accent-2 hover:underline"
        >
          Skip to the next order <ArrowRight size={12} />
        </Link>
      )}

      <ConfirmModal
        open={confirming}
        title="Mark this order shipped?"
        body={
          <>
            <p className="font-medium text-fg">
              #{order.orderNumber} · {cents(order.totalCents)}
            </p>
            <p className="mt-1.5 text-muted">
              A dispatch email goes to {order.customerEmail}
              {tracking.trim() ? ` with tracking ${tracking.trim()}` : " with no tracking number"}.
              {!allPacked && shippable.length > 0 && (
                <>
                  {" "}
                  You have {shippable.length - packed.size} item
                  {shippable.length - packed.size === 1 ? "" : "s"} still unticked.
                </>
              )}
            </p>
          </>
        }
        confirmLabel="Mark shipped"
        pending={pending}
        onConfirm={ship}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
