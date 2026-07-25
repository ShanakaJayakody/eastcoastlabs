"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Pencil } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { ProductListRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import {
  bulkAdjustStock,
  bulkPriceChange,
  saveVariantPrice,
  adjustStock,
} from "@/app/admin/(dashboard)/products/actions";

const cents = (c: number) => formatAud(c / 100);

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "received", label: "Stock received" },
  { value: "recount", label: "Recount" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Customer return" },
];

export default function ProductsTable({ products }: { products: ProductListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<MovementReason>("received");
  const [pct, setPct] = useState("");
  const [pending, start] = useTransition();

  // Inline price edit: click the price cell, type, Enter/blur to save.
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  // Inline stock quick-adjust: click "Available" to expand a compact form row.
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState<MovementReason>("received");

  const allVariantIds = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => v.id)),
    [products],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleProduct = (p: ProductListRow) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = p.variants.map((v) => v.id);
      const allOn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setSelected(new Set());
        setQty("");
        setPct("");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  const ids = [...selected];
  const field =
    "rounded-lg border border-line bg-ink-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent";

  return (
    <div className="space-y-3">
      {/* Bulk bar */}
      {ids.length > 0 && (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 backdrop-blur">
          <span className="text-sm font-medium text-accent">{ids.length} selected</span>
          <span className="mx-1 h-4 w-px bg-line-2" />
          <input
            placeholder="Qty ±"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d-]/g, ""))}
            className={`${field} w-20`}
          />
          <select value={reason} onChange={(e) => setReason(e.target.value as MovementReason)} className={field}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !qty}
            onClick={() => {
              const delta = Number(qty);
              const sel = [...ids];
              start(async () => {
                const res = await bulkAdjustStock(sel, delta, reason);
                if (!res.ok) {
                  toast.error(res.error ?? "Failed");
                  return;
                }
                setSelected(new Set());
                setQty("");
                toast.success(res.message ?? "Done", {
                  action: {
                    label: "Undo",
                    onClick: () =>
                      start(async () => {
                        const back = await bulkAdjustStock(sel, -delta, "recount");
                        if (back.ok) {
                          toast.success("Reverted");
                          router.refresh();
                        } else toast.error(back.error ?? "Undo failed");
                      }),
                  },
                });
                router.refresh();
              });
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Apply stock
          </button>
          <span className="mx-1 h-4 w-px bg-line-2" />
          <input
            placeholder="Price %"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ""))}
            className={`${field} w-20`}
          />
          <button
            disabled={pending || !pct}
            onClick={() => {
              if (confirm(`Change price of ${ids.length} variants by ${pct}%?`))
                run(() => bulkPriceChange(ids, Number(pct)));
            }}
            className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg disabled:opacity-50"
          >
            Reprice
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted hover:text-fg"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={ids.length > 0 && ids.length === allVariantIds.length}
                  onChange={() =>
                    setSelected(ids.length === allVariantIds.length ? new Set() : new Set(allVariantIds))
                  }
                  className="accent-accent"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Product</th>
              <th className="px-3 py-2.5 font-medium">Variant</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">On hand</th>
              <th className="px-3 py-2.5 text-right font-medium">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) =>
              p.variants.map((v, vi) => {
                const low = v.available <= v.low_stock_threshold;
                return (
                  <tr key={v.id} className="transition hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${v.sku}`}
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {vi === 0 ? (
                        <button onClick={() => toggleProduct(p)} className="text-left">
                          <Link
                            href={`/admin/products/${p.slug}`}
                            className="font-medium text-fg hover:text-accent"
                          >
                            {p.name}
                          </Link>
                          <span className="block text-xs text-muted">{p.sku}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-2">↳</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-fg-2">
                      {v.label}
                      <span className="block font-mono text-xs text-muted-2">{v.sku}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editingPrice === v.id ? (
                        <input
                          autoFocus
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value.replace(/[^\d.]/g, ""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingPrice(null);
                          }}
                          onBlur={() => {
                            const next = Number(priceDraft);
                            setEditingPrice(null);
                            if (!Number.isFinite(next) || next < 0 || next === v.price_cents / 100) return;
                            start(async () => {
                              const res = await saveVariantPrice(p.slug, v.id, next);
                              if (res.ok) {
                                toast.success(res.message ?? "Price updated");
                                router.refresh();
                              } else toast.error(res.error ?? "Failed");
                            });
                          }}
                          className="w-20 rounded-md border border-accent bg-ink-2 px-1.5 py-0.5 text-right text-sm text-fg outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPrice(v.id);
                            setPriceDraft((v.price_cents / 100).toFixed(2));
                          }}
                          className="group inline-flex items-center gap-1 text-fg-2 hover:text-accent"
                        >
                          {cents(v.price_cents)}
                          <Pencil size={11} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-fg-2">{v.on_hand}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditingStock(editingStock === v.id ? null : v.id);
                          setStockQty("");
                        }}
                        className="inline-flex items-center gap-1 hover:opacity-80"
                      >
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            low ? "text-warn" : "text-fg"
                          }`}
                        >
                          {low && <AlertTriangle size={13} />}
                          {v.available}
                        </span>
                      </button>
                      {v.reserved > 0 && (
                        <span className="block text-xs text-muted-2">{v.reserved} reserved</span>
                      )}
                    </td>
                  </tr>
                );
              }).concat(
                p.variants
                  .filter((v) => editingStock === v.id)
                  .map((v) => (
                    <tr key={`${v.id}-stock`} className="bg-ink-2">
                      <td colSpan={6} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted">Quick stock adjust for {v.sku}:</span>
                          <input
                            autoFocus
                            placeholder="Qty ±"
                            value={stockQty}
                            onChange={(e) => setStockQty(e.target.value.replace(/[^\d-]/g, ""))}
                            className={`${field} w-20`}
                          />
                          <select
                            value={stockReason}
                            onChange={(e) => setStockReason(e.target.value as MovementReason)}
                            className={field}
                          >
                            {REASONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={pending || !stockQty}
                            onClick={() => {
                              const delta = Number(stockQty);
                              start(async () => {
                                const res = await adjustStock(p.slug, v.id, delta, stockReason);
                                if (res.ok) {
                                  toast.success(res.message ?? "Stock updated");
                                  setEditingStock(null);
                                  setStockQty("");
                                  router.refresh();
                                } else toast.error(res.error ?? "Failed");
                              });
                            }}
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => setEditingStock(null)}
                            className="text-xs text-muted hover:text-fg"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )),
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
