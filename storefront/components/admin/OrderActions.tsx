"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmPayment, advanceStatus, refund, cancel, addNote } from "@/app/admin/(dashboard)/orders/actions";
import type { OrderStatus } from "@/lib/admin/orders";

const NEXT_LABEL: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  paid: { to: "processing", label: "Start packing" },
  processing: { to: "shipped", label: "Mark shipped" },
  shipped: { to: "completed", label: "Mark completed" },
};

export default function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paymentRef, setPaymentRef] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });

  const next = NEXT_LABEL[status];
  const closed = status === "completed" || status === "cancelled" || status === "refunded";
  const btn =
    "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";
  const field =
    "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg">Actions</h3>

      {status === "pending" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Payment is by bank transfer. Confirm once funds land — this decrements stock.
          </p>
          <input
            placeholder="Payment reference (optional)"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            className={field}
          />
          <button
            disabled={pending}
            onClick={() => run(() => confirmPayment(orderId, paymentRef), "Payment confirmed — stock decremented")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Confirm payment
          </button>
        </div>
      )}

      {status === "processing" || status === "paid" ? (
        <div className="space-y-2">
          <input
            placeholder="Tracking number"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className={field}
          />
          <button
            disabled={pending}
            onClick={() => run(() => advanceStatus(orderId, "shipped", tracking), "Marked shipped — customer emailed")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Mark shipped {tracking ? "with tracking" : ""}
          </button>
        </div>
      ) : null}

      {next && next.to !== "shipped" && (
        <button
          disabled={pending}
          onClick={() => run(() => advanceStatus(orderId, next.to), `Order ${next.to}`)}
          className={`${btn} w-full border border-line-2 bg-surface-2 text-fg hover:brightness-110`}
        >
          {next.label}
        </button>
      )}

      {!closed && (
        <div className="flex gap-2 border-t border-line pt-3">
          <button
            disabled={pending}
            onClick={() => run(() => refund(orderId), "Refunded — stock restored")}
            className={`${btn} flex-1 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
          >
            Refund
          </button>
          {(status === "pending" || status === "paid") && (
            <button
              disabled={pending}
              onClick={() => run(() => cancel(orderId), "Order cancelled")}
              className={`${btn} flex-1 border border-line-2 text-muted hover:text-fg`}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <textarea
          rows={2}
          placeholder="Add an internal note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              const r = await addNote(orderId, note);
              if (r.ok) setNote("");
              return r;
            }, "Note added")
          }
          className={`${btn} w-full border border-line-2 bg-surface-2 text-fg-2 hover:text-fg`}
        >
          Add note
        </button>
      </div>
    </div>
  );
}
