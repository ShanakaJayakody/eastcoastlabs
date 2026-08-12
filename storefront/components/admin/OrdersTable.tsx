"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { BadgeCheck, Printer, Truck } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { OrderListRow } from "@/lib/admin/order-queries";
import { bulkAdvanceStatus, bulkConfirmPayment } from "@/app/admin/(dashboard)/orders/actions";
import StatusBadge from "./StatusBadge";

const cents = (c: number) => formatAud(c / 100);

/** Orders that can still be shipped — drives whether the bulk bar offers it. */
const SHIPPABLE = new Set(["paid", "processing"]);
/** Orders still awaiting payment — drives whether the bulk bar offers "Mark paid". */
const PAYABLE = new Set(["pending"]);

export default function OrdersTable({ rows }: { rows: OrderListRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const shippableSelected = selectedRows.filter((r) => SHIPPABLE.has(r.status));
  const payableSelected = selectedRows.filter((r) => PAYABLE.has(r.status));

  function markPaid() {
    const ids = payableSelected.map((r) => r.id);
    start(async () => {
      const res = await bulkConfirmPayment(ids);
      if (res.ok) {
        toast.success(
          `${res.moved} order${res.moved === 1 ? "" : "s"} marked paid${
            res.failed?.length ? ` · ${res.failed.length} failed` : ""
          }`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error ?? "Bulk update failed");
      }
    });
  }

  function markShipped() {
    const ids = shippableSelected.map((r) => r.id);
    start(async () => {
      const res = await bulkAdvanceStatus(ids, "shipped");
      if (res.ok) {
        toast.success(
          `${res.moved} order${res.moved === 1 ? "" : "s"} marked shipped${
            res.failed?.length ? ` · ${res.failed.length} failed` : ""
          }`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error ?? "Bulk update failed");
      }
    });
  }

  function printSlips() {
    const ids = selectedRows.map((r) => r.id).join(",");
    window.open(`/admin/orders/slips?ids=${ids}`, "_blank");
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all orders"
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Items</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Placed</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                className={`cursor-pointer transition hover:bg-surface-2 ${
                  selected.has(o.id) ? "bg-accent/5" : ""
                }`}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    aria-label={`Select ${o.order_number}`}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-accent hover:underline"
                  >
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-fg-2">{o.customer_name || "—"}</span>
                  <span className="block text-xs text-muted">{o.customer_email}</span>
                </td>
                <td className="hidden px-4 py-3 text-fg-2 sm:table-cell">{o.item_count}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  {new Date(o.created_at).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3 text-right font-medium text-fg">{cents(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          selected.size > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-fg-2">
            {selected.size} selected
            {payableSelected.length + shippableSelected.length < selected.size && (
              <span className="ml-2 text-xs text-muted">
                ({selected.size - payableSelected.length - shippableSelected.length} with no bulk
                action)
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-line-2 px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
            >
              Clear
            </button>
            <button
              onClick={printSlips}
              className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
            >
              <Printer size={15} /> Print slips
            </button>
            {payableSelected.length > 0 && (
              <button
                disabled={pending}
                onClick={markPaid}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <BadgeCheck size={15} />
                {pending ? "Working…" : `Mark ${payableSelected.length} paid`}
              </button>
            )}
            {shippableSelected.length > 0 && (
              <button
                disabled={pending}
                onClick={markShipped}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
              >
                <Truck size={15} />
                {pending ? "Working…" : `Mark ${shippableSelected.length} shipped`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
