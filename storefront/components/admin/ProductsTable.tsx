"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Package,
  Pencil,
} from "lucide-react";
import { formatAud } from "@/lib/format";
import type { ProductListRow, VariantRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import {
  bulkAdjustStock,
  bulkPriceChange,
  saveVariantPrice,
} from "@/app/admin/(dashboard)/products/actions";
import Badge, { type BadgeTone } from "./Badge";
import ConfirmModal from "./ConfirmModal";
import StockDrawer, { type StockTarget } from "./StockDrawer";

const cents = (c: number) => formatAud(c / 100);

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "received", label: "Stock received" },
  { value: "recount", label: "Recount" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Customer return" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  draft: "neutral",
  coming_soon: "info",
  archived: "neutral",
};

const statusLabel = (s: string) => (s === "coming_soon" ? "Coming soon" : s);

/**
 * Stock lives once per product, in vials, on the 1-vial tier — every other tier
 * derives from it. Adjustments must target that variant or they'd write to a
 * pack row whose numbers are only a projection.
 */
const poolVariant = (p: ProductListRow): VariantRow | null =>
  p.variants.find((v) => v.pack_size === 1) ??
  p.variants.slice().sort((a, b) => a.pack_size - b.pack_size)[0] ??
  null;

const priceRange = (p: ProductListRow) => {
  if (!p.variants.length) return "—";
  const prices = p.variants.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? cents(min) : `${cents(min)} – ${cents(max)}`;
};

type SortKey = "name" | "stock" | "price";

const field =
  "rounded-lg border border-line bg-ink-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent";

export default function ProductsTable({ products }: { products: ProductListRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  // Bulk bar drafts
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<MovementReason>("received");
  const [pct, setPct] = useState("");
  const [confirmReprice, setConfirmReprice] = useState(false);

  // Inline price edit on a tier row: click the price, type, Enter/blur to save.
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  // Clicking a vial count opens the same drawer the editor uses.
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);

  const openStock = (p: ProductListRow, pool: VariantRow) =>
    setStockTarget({
      slug: p.slug,
      name: p.name,
      poolId: pool.id,
      vialsOnHand: p.totalOnHand,
      unitCostCents: p.unit_cost_cents,
      variants: p.variants,
    });

  const rows = useMemo(() => {
    const dir = sort.dir;
    return products.slice().sort((a, b) => {
      if (sort.key === "stock") return (a.totalOnHand - b.totalOnHand) * dir;
      if (sort.key === "price") return (a.minPriceCents - b.minPriceCents) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [products, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));

  const selectedProducts = rows.filter((p) => selected.has(p.id));
  const poolIds = selectedProducts
    .map((p) => poolVariant(p)?.id)
    .filter((id): id is string => Boolean(id));
  const variantIds = selectedProducts.flatMap((p) => p.variants.map((v) => v.id));

  const clearSelection = () => setSelected(new Set());

  function applyBulkStock() {
    const delta = Number(qty);
    const ids = [...poolIds];
    start(async () => {
      const res = await bulkAdjustStock(ids, delta, reason);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      clearSelection();
      setQty("");
      toast.success(res.message ?? "Done", {
        action: {
          label: "Undo",
          onClick: () =>
            start(async () => {
              const back = await bulkAdjustStock(ids, -delta, "recount");
              if (back.ok) {
                toast.success("Reverted");
                router.refresh();
              } else toast.error(back.error ?? "Undo failed");
            }),
        },
      });
      router.refresh();
    });
  }

  function applyReprice() {
    start(async () => {
      const res = await bulkPriceChange(variantIds, Number(pct));
      setConfirmReprice(false);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        clearSelection();
        setPct("");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  }

  function savePrice(p: ProductListRow, v: VariantRow) {
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
  }

  const SortHeader = ({
    label,
    sortKey,
    className = "",
  }: {
    label: string;
    sortKey: SortKey;
    className?: string;
  }) => (
    <th className={`px-3 py-2.5 font-medium ${className}`}>
      <button
        onClick={() => toggleSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-fg-2 ${
          sort.key === sortKey ? "text-fg-2" : ""
        }`}
      >
        {label}
        {sort.key === sortKey ? (
          <ChevronDown size={12} className={sort.dir === -1 ? "rotate-180" : ""} />
        ) : (
          <ChevronsUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all products"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(rows.map((p) => p.id)))
                  }
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
              </th>
              <th className="w-8 px-1 py-2.5" />
              <SortHeader label="Product" sortKey="name" />
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Tiers</th>
              <SortHeader label="Price" sortKey="price" className="hidden text-right md:table-cell" />
              <SortHeader label="Stock" sortKey="stock" className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const pool = poolVariant(p);
              const isOpen = expanded.has(p.id);
              const isSelected = selected.has(p.id);
              return [
                <tr
                  key={p.id}
                  className={`transition hover:bg-surface-2 ${isSelected ? "bg-accent/5" : ""}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                  </td>
                  <td className="px-1 py-2.5">
                    {p.variants.length > 0 && (
                      <button
                        onClick={() => toggleExpand(p.id)}
                        aria-label={isOpen ? `Collapse ${p.name}` : `Expand ${p.name}`}
                        aria-expanded={isOpen}
                        className="rounded p-1 text-muted transition hover:bg-surface hover:text-fg"
                      >
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-md border border-line object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-ink-2 text-muted-2">
                          <Package size={15} />
                        </span>
                      )}
                      <span className="min-w-0">
                        <Link
                          href={`/admin/products/${p.slug}`}
                          className="block truncate font-medium text-fg hover:text-accent"
                        >
                          {p.name}
                        </Link>
                        <span className="block truncate font-mono text-xs text-muted">
                          {p.sku ?? p.slug}
                        </span>
                        {/* Status and price fold under the name once their own
                            columns drop away on narrow screens. */}
                        <span className="mt-1 flex items-center gap-2 sm:hidden">
                          <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>
                            {statusLabel(p.status)}
                          </Badge>
                          <span className="text-xs text-muted">{priceRange(p)}</span>
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{statusLabel(p.status)}</Badge>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted lg:table-cell">
                    {p.variants.length || "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-fg-2 md:table-cell">
                    {priceRange(p)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {pool ? (
                      <button
                        onClick={() => openStock(p, pool)}
                        className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium transition hover:bg-surface"
                        title="Adjust stock"
                      >
                        {p.lowStock && <AlertTriangle size={13} className="text-warn" />}
                        <span className={p.lowStock ? "text-warn" : "text-fg"}>
                          {p.totalOnHand}
                        </span>
                        <Pencil size={11} className="text-muted-2" />
                      </button>
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </td>
                </tr>,

                // Expanded tier breakdown
                isOpen ? (
                  <tr key={`${p.id}-tiers`} className="bg-ink-2/60">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="ml-12 overflow-hidden rounded-lg border border-line">
                        <table className="w-full text-xs">
                          <thead className="bg-surface text-left uppercase tracking-wide text-muted">
                            <tr>
                              <th className="px-3 py-2 font-medium">Tier</th>
                              <th className="px-3 py-2 font-medium">SKU</th>
                              <th className="px-3 py-2 text-right font-medium">Price</th>
                              <th className="px-3 py-2 text-right font-medium">Can fill</th>
                              <th className="px-3 py-2 text-right font-medium">Low at</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {p.variants.map((v) => {
                              const low = v.available <= v.low_stock_threshold;
                              return (
                                <tr key={v.id}>
                                  <td className="px-3 py-2 font-medium text-fg-2">{v.label}</td>
                                  <td className="px-3 py-2 font-mono text-muted-2">{v.sku}</td>
                                  <td className="px-3 py-2 text-right">
                                    {editingPrice === v.id ? (
                                      <input
                                        autoFocus
                                        value={priceDraft}
                                        onChange={(e) =>
                                          setPriceDraft(e.target.value.replace(/[^\d.]/g, ""))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") e.currentTarget.blur();
                                          if (e.key === "Escape") setEditingPrice(null);
                                        }}
                                        onBlur={() => savePrice(p, v)}
                                        aria-label={`Price for ${v.sku}`}
                                        className="w-20 rounded-md border border-accent bg-ink-2 px-1.5 py-0.5 text-right text-xs text-fg outline-none"
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
                                        <Pencil
                                          size={10}
                                          className="text-muted-2 group-hover:text-accent"
                                        />
                                      </button>
                                    )}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right ${low ? "text-warn" : "text-fg-2"}`}
                                  >
                                    {v.available}
                                    {v.reserved > 0 && (
                                      <span className="block text-[10px] text-muted-2">
                                        {v.reserved} reserved
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-muted">
                                    {v.low_stock_threshold}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="border-t border-line bg-surface px-3 py-1.5 text-[11px] text-muted-2">
                          {p.totalOnHand} vials — each tier shows how many whole packs they fill, not
                          separate stock.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          selected.size > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-sm font-medium text-fg">
            {selected.size} product{selected.size === 1 ? "" : "s"}
          </span>
          <span className="mx-1 h-4 w-px bg-line-2" />
          <input
            placeholder="Vials ±"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d-]/g, ""))}
            aria-label="Bulk quantity change"
            className={`${field} w-24`}
          />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as MovementReason)}
            aria-label="Bulk reason"
            className={field}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !qty || poolIds.length === 0}
            onClick={applyBulkStock}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Apply stock
          </button>
          <span className="mx-1 h-4 w-px bg-line-2" />
          <input
            placeholder="Price %"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ""))}
            aria-label="Bulk price percentage"
            className={`${field} w-24`}
          />
          <button
            disabled={pending || !pct || variantIds.length === 0}
            onClick={() => setConfirmReprice(true)}
            className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg disabled:opacity-50"
          >
            Reprice
          </button>
          {poolIds.length < selected.size && (
            <span className="text-xs text-muted">
              {selected.size - poolIds.length} without stock
            </span>
          )}
          <button
            onClick={clearSelection}
            className="ml-auto text-xs text-muted hover:text-fg"
          >
            Clear
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmReprice}
        title="Reprice selected products?"
        body={`Every tier of ${selected.size} product${
          selected.size === 1 ? "" : "s"
        } (${variantIds.length} variants) will change by ${pct}%. This updates the live storefront.`}
        confirmLabel="Reprice"
        pending={pending}
        onConfirm={applyReprice}
        onCancel={() => setConfirmReprice(false)}
      />

      <StockDrawer target={stockTarget} onClose={() => setStockTarget(null)} />
    </>
  );
}
