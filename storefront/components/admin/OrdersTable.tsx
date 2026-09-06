"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, BadgeCheck, Printer, RotateCcw, Truck } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { OrderListRow } from "@/lib/admin/order-queries";
import { bulkAdvanceStatus, bulkConfirmPayment, bulkReinstate } from "@/app/admin/(dashboard)/orders/actions";
import type { OrderSort } from "@/lib/admin/order-queries";
import StatusBadge from "./StatusBadge";
import ConfirmModal from "./ConfirmModal";

const cents = (c: number) => formatAud(c / 100);

/** Orders that can still be shipped — drives whether the bulk bar offers it. */
const SHIPPABLE = new Set(["paid", "processing"]);
/** Orders still awaiting payment — drives whether the bulk bar offers "Mark paid". */
const PAYABLE = new Set(["pending"]);
/** Cancelled orders can come back if their stock is still free. */
const REINSTATABLE = new Set(["cancelled"]);

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
  const [confirming, setConfirming] = useState<"ship" | "pay" | "reinstate" | null>(null);
  // -1 means "nothing focused yet"; the first j or k lands on the first row.
  const [cursor, setCursor] = useState(-1);
  const rowsRef = useRef<(HTMLTableRowElement | null)[]>([]);

  /**
   * Keyboard row navigation, vi-style.
   *
   * Bound to the document rather than a container because the table has no
   * natural focus host and the operator's hands are on the keyboard, not in it.
   * Anything typed into an input or with a modifier held is left alone — the
   * search box and the browser's own shortcuts come first.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // A dialog owns the keyboard while it is open — otherwise Enter would
      // navigate away from the very confirmation being read.
      if (confirming !== null) return;
      const target = event.target as HTMLElement | null;
      // Buttons and links are excluded too: Enter on a focused control is the
      // browser activating it, and preventDefault here would swallow that and
      // navigate to the highlighted row instead.
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName) ||
          target.closest("button, a"))
      ) {
        return;
      }
      if (rows.length === 0) return;

      const move = (delta: number) => {
        event.preventDefault();
        setCursor((current) => {
          const next = Math.min(rows.length - 1, Math.max(0, current < 0 ? 0 : current + delta));
          rowsRef.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      };

      if (event.key === "j") move(1);
      else if (event.key === "k") move(-1);
      else if (event.key === "x" && cursor >= 0) {
        event.preventDefault();
        toggle(rows[cursor].id);
      } else if (event.key === "Enter" && cursor >= 0) {
        event.preventDefault();
        router.push(`/admin/orders/${rows[cursor].id}`);
      } else if (event.key === "Escape") {
        setCursor(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // `toggle` is stable in behaviour; rows and cursor are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cursor, router, confirming]);

  // A shorter page after filtering must not leave the cursor past the end.
  useEffect(() => {
    setCursor((c) => (c >= rows.length ? rows.length - 1 : c));
  }, [rows.length]);

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
  const reinstatableSelected = selectedRows.filter((r) => REINSTATABLE.has(r.status));

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

  function reinstateSelected() {
    const ids = reinstatableSelected.map((r) => r.id);
    setConfirming(null);
    start(async () => {
      const res = await bulkReinstate(ids);
      if (res.done > 0) {
        toast.success(`${res.done} order${res.done === 1 ? "" : "s"} reinstated and marked paid`);
      }
      // Stock running out mid-batch is the expected failure here, not an
      // exception — name the count so the operator knows to open those.
      if (res.failed.length) {
        toast.error(
          `${res.failed.length} could not be reinstated — open them to see what is short`,
        );
      }
      setSelected(new Set());
      router.refresh();
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
            {rows.map((o, i) => (
              <tr
                key={o.id}
                ref={(el) => {
                  rowsRef.current[i] = el;
                }}
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                aria-current={i === cursor ? "true" : undefined}
                className={`cursor-pointer transition hover:bg-surface-2 ${
                  i === cursor ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : ""
                } ${selected.has(o.id) ? "bg-accent/5" : ""}`}
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

      <p className="mt-2 hidden text-[11px] text-muted-2 sm:block">
        <kbd className="rounded border border-line-2 px-1">j</kbd>{" "}
        <kbd className="rounded border border-line-2 px-1">k</kbd> move ·{" "}
        <kbd className="rounded border border-line-2 px-1">x</kbd> select ·{" "}
        <kbd className="rounded border border-line-2 px-1">Enter</kbd> open
      </p>

      {/* Bulk action bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          selected.size > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-fg-2">
            {selected.size} selected
            {payableSelected.length + shippableSelected.length + reinstatableSelected.length <
              selected.size && (
              <span className="ml-2 text-xs text-muted">
                (
                {selected.size -
                  payableSelected.length -
                  shippableSelected.length -
                  reinstatableSelected.length}{" "}
                with no bulk action)
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
            {reinstatableSelected.length > 0 && (
              <button
                disabled={pending}
                onClick={() => setConfirming("reinstate")}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
              >
                <RotateCcw size={15} /> Reinstate {reinstatableSelected.length} &amp; mark paid
              </button>
            )}
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
        title={
          confirming === "pay"
            ? "Mark these orders paid?"
            : confirming === "reinstate"
              ? "Reinstate these cancelled orders?"
              : "Mark these orders shipped?"
        }
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
          ) : confirming === "reinstate" ? (
            <>
              <p className="font-medium text-fg">
                {reinstatableSelected.length} cancelled order
                {reinstatableSelected.length === 1 ? "" : "s"} ·{" "}
                {cents(reinstatableSelected.reduce((s, r) => s + r.total_cents, 0))}
              </p>
              <p className="mt-1.5 text-muted">
                Each one re-takes its stock, is marked paid, and emails a receipt. Any order whose
                items have since sold out is skipped and reported back — the rest still go through.
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
        confirmLabel={
          confirming === "pay"
            ? "Mark paid"
            : confirming === "reinstate"
              ? "Reinstate & mark paid"
              : "Mark shipped"
        }
        pending={pending}
        onConfirm={() =>
          confirming === "pay"
            ? markPaid()
            : confirming === "reinstate"
              ? reinstateSelected()
              : markShipped()
        }
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
