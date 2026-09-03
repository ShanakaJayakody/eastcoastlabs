"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, BadgeCheck, Printer, Truck } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { OrderListRow } from "@/lib/admin/order-queries";
import { bulkAdvanceStatus, bulkConfirmPayment } from "@/app/admin/(dashboard)/orders/actions";
import type { OrderSort } from "@/lib/admin/order-queries";
import StatusBadge from "./StatusBadge";
import ConfirmModal from "./ConfirmModal";

const cents = (c: number) => formatAud(c / 100);

/** Orders that can still be shipped — drives whether the bulk bar offers it. */
const SHIPPABLE = new Set(["paid", "processing"]);
/** Orders still awaiting payment — drives whether the bulk bar offers "Mark paid". */
const PAYABLE = new Set(["pending"]);

/** Column header → sort key. Headers without one are not sortable. */
const COLUMNS: { key: OrderSort | null; label: string; className?: string; align?: "right" }[] = [
  { key: "order_number", label: "Order" },
  { key: null, label: "Customer" },
  { key: null, label: "Items", className: "hidden sm:table-cell" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Placed", className: "hidden md:table-cell" },
  { key: "total_cents", label: "Total", align: "right" },
];

export default function OrdersTable({
  rows,
  sort = "created_at",
  dir = "desc",
  query,
}: {
  rows: OrderListRow[];
  sort?: OrderSort;
  dir?: "asc" | "desc";
  /**
   * The other active filters, as plain strings. A callback would be the obvious
   * shape here, but functions cannot cross the server/client boundary — passing
   * one throws at render, and neither typecheck nor build catches it.
   */
  query?: { status?: string; q?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"ship" | "pay" | null>(null);

  /** Header link that changes the sort while keeping every other filter. */
  const sortHref = (nextSort: OrderSort, nextDir: "asc" | "desc"): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("sort", nextSort);
    params.set("dir", nextDir);
    return `/admin/orders?${params.toString()}`;
  };

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
    setConfirming(null);
    start(async () => {
      const res = await bulkConfirmPayment(ids);
      if (res.ok) {
        toast.success(`${res.moved} order${res.moved === 1 ? "" : "s"} marked paid`);
        if (res.failed?.length) {
          toast.error(
            `${res.failed.length} order${res.failed.length === 1 ? "" : "s"} did not move — open them individually to see why`,
          );
        }
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error ?? "Bulk update failed");
      }
    });
  }

  function markShipped() {
    const ids = shippableSelected.map((r) => r.id);
    setConfirming(null);
    start(async () => {
      const res = await bulkAdvanceStatus(ids, "shipped");
      if (res.ok) {
        toast.success(`${res.moved} order${res.moved === 1 ? "" : "s"} marked shipped`);
        if (res.failed?.length) {
          toast.error(
            `${res.failed.length} order${res.failed.length === 1 ? "" : "s"} did not move — open them individually to see why`,
          );
        }
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
              {COLUMNS.map((col) => {
                const active = col.key != null && col.key === sort;
                const nextDir: "asc" | "desc" = active && dir === "desc" ? "asc" : "desc";
                const classes = `px-4 py-2.5 font-medium ${col.className ?? ""} ${
                  col.align === "right" ? "text-right" : ""
                }`;
                if (!col.key) {
                  return (
                    <th key={col.label} className={classes}>
                      {col.label}
                    </th>
                  );
                }
                return (
                  <th key={col.label} className={classes}>
                    <Link
                      href={sortHref(col.key, nextDir)}
                      scroll={false}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`inline-flex items-center gap-1 transition hover:text-fg-2 ${
                        active ? "text-fg-2" : ""
                      }`}
                    >
                      {col.label}
                      {active && <ArrowUpDown size={11} className={dir === "asc" ? "rotate-180" : ""} />}
                    </Link>
                  </th>
                );
              })}
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
                onClick={() => setConfirming("pay")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <BadgeCheck size={15} />
                {pending ? "Working…" : `Mark ${payableSelected.length} paid`}
              </button>
            )}
            {shippableSelected.length > 0 && (
              <button
                disabled={pending}
                onClick={() => setConfirming("ship")}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
              >
                <Truck size={15} />
                {pending ? "Working…" : `Mark ${shippableSelected.length} shipped`}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirming !== null}
        title={confirming === "pay" ? "Mark these orders paid?" : "Mark these orders shipped?"}
        body={
          confirming === "pay" ? (
            <>
              <p className="font-medium text-fg">
                {payableSelected.length} order{payableSelected.length === 1 ? "" : "s"} ·{" "}
                {cents(payableSelected.reduce((s, r) => s + r.total_cents, 0))}
              </p>
              <p className="mt-1.5 text-muted">
                Each one decrements stock and emails a receipt to the customer. Only do this for
                transfers you have actually seen land.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-fg">
                {shippableSelected.length} order{shippableSelected.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1.5 text-muted">
                Each customer gets a dispatch email. Tracking numbers can only be attached one order
                at a time, so orders sent here go out without one.
              </p>
            </>
          )
        }
        confirmLabel={confirming === "pay" ? "Mark paid" : "Mark shipped"}
        pending={pending}
        onConfirm={() => (confirming === "pay" ? markPaid() : markShipped())}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
