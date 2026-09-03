"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { OrderStatus } from "@/lib/admin/orders";
import { editItemQty, removeItem, refundLines } from "@/app/admin/(dashboard)/orders/actions";
import ConfirmModal from "./ConfirmModal";

export interface ItemRow {
  id: string;
  product_name: string | null;
  variant_label: string | null;
  sku: string | null;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
  refunded_qty: number;
  refunded_cents: number;
}

const cents = (c: number) => formatAud(c / 100);
const btn = "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";

export default function OrderItemsPanel({
  orderId,
  status,
  items,
  subtotalCents,
  discountCents,
  discountCode,
  shippingCents,
  totalCents,
}: {
  orderId: string;
  status: OrderStatus;
  items: ItemRow[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  totalCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refundQty, setRefundQty] = useState<Record<string, number>>({});
  const [removing, setRemoving] = useState<ItemRow | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const editable = status === "pending";
  const refundable = status !== "pending" && status !== "cancelled" && status !== "refunded";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Failed");
    });

  const refundLineCount = Object.values(refundQty).filter((q) => q > 0).length;

  const selectedRefundCents = items.reduce((sum, it) => {
    const q = refundQty[it.id] ?? 0;
    return sum + q * it.unit_price_cents;
  }, 0);
  const anySelected = Object.values(refundQty).some((q) => q > 0);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Items</h3>
        {editable && <span className="text-xs text-muted">Editable — order not yet paid</span>}
        {refundable && <span className="text-xs text-muted">Select quantities to refund</span>}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-line">
          {items.map((it) => {
            const remaining = it.qty - it.refunded_qty;
            return (
              <tr key={it.id}>
                <td className="px-4 py-3">
                  <span className="text-fg-2">{it.product_name}</span>
                  <span className="block text-xs text-muted">
                    {it.variant_label}
                    {it.sku ? ` · ${it.sku}` : " · accessory"}
                  </span>
                  {it.refunded_qty > 0 && (
                    <span className="mt-0.5 block text-xs text-warn">
                      {it.refunded_qty} refunded ({cents(it.refunded_cents)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted">{cents(it.unit_price_cents)}</td>

                {editable && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        disabled={pending}
                        onClick={() => run(() => editItemQty(orderId, it.id, it.qty - 1))}
                        className={`${btn} border border-line-2 text-fg-2`}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-fg-2">{it.qty}</span>
                      <button
                        disabled={pending}
                        onClick={() => run(() => editItemQty(orderId, it.id, it.qty + 1))}
                        className={`${btn} border border-line-2 text-fg-2`}
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => setRemoving(it)}
                        className="ml-1 text-muted hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                )}

                {refundable && (
                  <td className="px-4 py-3 text-right">
                    {remaining > 0 ? (
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        value={refundQty[it.id] ?? 0}
                        onChange={(e) =>
                          setRefundQty({
                            ...refundQty,
                            [it.id]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-14 rounded-md border border-line bg-ink-2 px-2 py-1 text-right text-sm text-fg outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="text-xs text-muted-2">fully refunded</span>
                    )}
                  </td>
                )}

                {!editable && !refundable && (
                  <td className="px-4 py-3 text-right text-muted">× {it.qty}</td>
                )}

                <td className="px-4 py-3 text-right font-medium text-fg">{cents(it.line_total_cents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {refundable && anySelected && (
        <div className="flex items-center justify-between border-t border-line bg-ink-2 px-4 py-3">
          <span className="text-sm text-fg-2">Refund total: {cents(selectedRefundCents)}</span>
          <button
            disabled={pending}
            onClick={() => setConfirmRefund(true)}
            className={`${btn} bg-accent px-3 py-1.5 text-accent-ink hover:brightness-95`}
          >
            Refund selected
          </button>
        </div>
      )}

      <ConfirmModal
        open={removing !== null}
        title="Remove this line?"
        body={
          removing && (
            <>
              <p className="font-medium text-fg">
                {removing.product_name}
                {removing.variant_label ? ` · ${removing.variant_label}` : ""}
              </p>
              <p className="mt-1.5 text-muted">
                Removes {removing.qty} × {cents(removing.unit_price_cents)} from this order and
                releases the stock it had reserved. The order total drops by{" "}
                {cents(removing.line_total_cents)}.
              </p>
            </>
          )
        }
        confirmLabel="Remove line"
        tone="danger"
        pending={pending}
        onConfirm={() => {
          const target = removing;
          if (!target) return;
          setRemoving(null);
          run(() => removeItem(orderId, target.id));
        }}
        onCancel={() => setRemoving(null)}
      />

      <ConfirmModal
        open={confirmRefund}
        title="Refund these lines?"
        body={
          <>
            <p className="font-medium text-fg">{cents(selectedRefundCents)} back to the customer</p>
            <p className="mt-1.5 text-muted">
              Across {refundLineCount} line{refundLineCount === 1 ? "" : "s"}. The refunded stock is
              returned to inventory. Money is not moved automatically — refund it in your payment
              provider or bank separately.
            </p>
          </>
        }
        confirmLabel="Record refund"
        tone="danger"
        pending={pending}
        onConfirm={() => {
          const lines = Object.entries(refundQty)
            .filter(([, q]) => q > 0)
            .map(([itemId, qty]) => ({ itemId, qty }));
          start(async () => {
            const res = await refundLines(orderId, lines);
            if (res.ok) {
              toast.success(
                `Refunded ${cents(res.refundedCents ?? 0)}${res.fullyRefunded ? " — order fully refunded" : ""}`,
              );
              setRefundQty({});
              setConfirmRefund(false);
              router.refresh();
            } else toast.error(res.error ?? "Refund failed");
          });
        }}
        onCancel={() => setConfirmRefund(false)}
      />

      <dl className="space-y-1.5 border-t border-line px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="text-fg-2">{cents(subtotalCents)}</dd>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">
              Discount {discountCode && <span className="font-mono text-xs">{discountCode}</span>}
            </dt>
            <dd className="text-success">−{cents(discountCents)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd className="text-fg-2">{shippingCents === 0 ? "Free" : cents(shippingCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 text-base">
          <dt className="font-semibold text-fg">Total</dt>
          <dd className="font-semibold text-fg">{cents(totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}
