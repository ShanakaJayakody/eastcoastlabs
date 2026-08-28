"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Boxes,
} from "lucide-react";
import { formatAud } from "@/lib/format";
import { marginOf, tierCostCents } from "@/lib/admin/costs";
import type { ProductDetail, MovementRow } from "@/lib/admin/products";
import {
  saveProductAll,
  duplicateProductAction,
  saveUnitCost,
} from "@/app/admin/(dashboard)/products/actions";
import RichTextEditor from "./RichTextEditor";
import ProductImages from "./ProductImages";
import SeoPreview from "./SeoPreview";
import Badge, { type BadgeTone } from "./Badge";
import StockDrawer, { type StockTarget } from "./StockDrawer";

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";
const btn = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";
const card = "rounded-xl border border-line bg-surface";

type Status = "active" | "draft" | "archived" | "coming_soon";

const STATUSES: { value: Status; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "archived", label: "Archived" },
];

const STATUS_TONE: Record<Status, BadgeTone> = {
  active: "success",
  draft: "neutral",
  coming_soon: "info",
  archived: "neutral",
};

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "media", label: "Media" },
  { id: "pricing", label: "Pricing" },
  { id: "inventory", label: "Inventory" },
  { id: "seo", label: "SEO" },
];

export interface ProductNeighbour {
  slug: string;
  name: string;
}

export default function ProductEditor({
  product,
  movements,
  waitlist,
  prev,
  next,
}: {
  product: ProductDetail;
  /** Ledger for the vial pool — the only variant stock actually lives on. */
  movements: MovementRow[];
  waitlist: number;
  prev: ProductNeighbour | null;
  next: ProductNeighbour | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // ---- One form state for everything the save bar commits ----
  const initial = useMemo(
    () => ({
      name: product.name,
      shortDesc: product.short_description ?? "",
      desc: product.description ?? "",
      seoTitle: product.seo_title ?? "",
      seoDesc: product.seo_description ?? "",
      status: product.status as Status,
      prices: Object.fromEntries(
        product.variants.map((v) => [v.id, (v.price_cents / 100).toFixed(2)]),
      ) as Record<string, string>,
      thresholds: Object.fromEntries(
        product.variants.map((v) => [v.id, String(v.low_stock_threshold)]),
      ) as Record<string, string>,
    }),
    [product],
  );

  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  // Guard against losing edits on navigate/close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function saveAll() {
    start(async () => {
      const res = await saveProductAll(
        product.slug,
        {
          name: form.name,
          short_description: form.shortDesc,
          description: form.desc,
          seo_title: form.seoTitle,
          seo_description: form.seoDesc,
          status: form.status,
        },
        product.variants.map((v) => ({
          id: v.id,
          priceAud: Number(form.prices[v.id]),
          threshold: Number(form.thresholds[v.id] || 0),
        })),
      );
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error ?? "Save failed");
    });
  }

  // ---- Stock: one pool of vials, managed in the drawer (ledger, not form) ----
  const pool = product.variants.find((v) => v.pack_size === 1) ?? null;
  const vialsOnHand = pool?.on_hand ?? 0;
  const [stockOpen, setStockOpen] = useState(false);

  const stockTarget: StockTarget | null = pool
    ? {
        slug: product.slug,
        name: product.name,
        poolId: pool.id,
        vialsOnHand,
        unitCostCents: product.unit_cost_cents,
        variants: product.variants,
      }
    : null;

  // ---- Cost basis lives here, next to the stock it values ----
  const [costDraft, setCostDraft] = useState(
    product.unit_cost_cents == null ? "" : (product.unit_cost_cents / 100).toFixed(2),
  );
  useEffect(() => {
    setCostDraft(product.unit_cost_cents == null ? "" : (product.unit_cost_cents / 100).toFixed(2));
  }, [product.unit_cost_cents]);

  function duplicate() {
    start(async () => {
      const res = await duplicateProductAction(product.slug);
      if (res.ok && res.slug) {
        toast.success(res.message ?? "Duplicated");
        router.push(`/admin/products/${res.slug}`);
      } else toast.error(res.error ?? "Duplicate failed");
    });
  }

  const lowStock = product.variants.some((v) => v.available <= v.low_stock_threshold);

  return (
    <>
      {/* ---- Sticky header: identity, status, movement between products ---- */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/products"
            aria-label="Back to products"
            className="rounded-md p-1 text-muted transition hover:text-fg"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-fg">{product.name}</h2>
            <p className="truncate font-mono text-xs text-muted">{product.slug}</p>
          </div>

          <div className="flex items-center gap-1">
            {prev ? (
              <Link
                href={`/admin/products/${prev.slug}`}
                title={`Previous: ${prev.name}`}
                aria-label={`Previous product: ${prev.name}`}
                className="rounded-md border border-line-2 p-1.5 text-muted transition hover:text-fg"
              >
                <ChevronLeft size={15} />
              </Link>
            ) : (
              <span className="rounded-md border border-line p-1.5 text-muted-2 opacity-40">
                <ChevronLeft size={15} />
              </span>
            )}
            {next ? (
              <Link
                href={`/admin/products/${next.slug}`}
                title={`Next: ${next.name}`}
                aria-label={`Next product: ${next.name}`}
                className="rounded-md border border-line-2 p-1.5 text-muted transition hover:text-fg"
              >
                <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="rounded-md border border-line p-1.5 text-muted-2 opacity-40">
                <ChevronRight size={15} />
              </span>
            )}
          </div>

          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg"
          >
            <ExternalLink size={14} /> View
          </a>
          <button
            disabled={pending}
            onClick={duplicate}
            className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg disabled:opacity-50"
          >
            <Copy size={14} /> Duplicate
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Status as a segmented control — the single most-changed field
              shouldn't be a dropdown buried in a sidebar. */}
          <div
            role="radiogroup"
            aria-label="Product status"
            className="flex rounded-lg border border-line bg-ink-2 p-0.5"
          >
            {STATUSES.map((s) => {
              const on = form.status === s.value;
              return (
                <button
                  key={s.value}
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("status", s.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    on ? "bg-accent text-accent-ink" : "text-muted hover:text-fg"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {form.status !== "active" && (
            <Badge tone={STATUS_TONE[form.status]}>Not on the storefront</Badge>
          )}

          <button
            onClick={() => setStockOpen(true)}
            disabled={!stockTarget}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-fg-2 transition hover:text-fg disabled:opacity-50"
          >
            <Boxes size={13} />
            <span className={lowStock ? "font-semibold text-warn" : "font-semibold text-fg"}>
              {vialsOnHand}
            </span>
            vials
          </button>

          {waitlist > 0 && <Badge tone="info">{waitlist} waiting for restock</Badge>}

          {/* In-page wayfinding — the editor is a long scroll by nature. */}
          <nav className="ml-auto hidden gap-1 md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface hover:text-fg"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="grid gap-6 pb-24 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---- Details ---- */}
          <section id="details" className={`${card} scroll-mt-40 p-5`}>
            <h3 className="mb-4 text-sm font-semibold text-fg">Details</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Short description</label>
                <RichTextEditor
                  value={form.shortDesc}
                  onChange={(v) => set("shortDesc", v)}
                  minHeight={80}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Full description</label>
                <RichTextEditor value={form.desc} onChange={(v) => set("desc", v)} minHeight={200} />
              </div>
            </div>
          </section>

          {/* ---- Media ---- */}
          <div id="media" className="scroll-mt-40">
            <ProductImages slug={product.slug} images={product.images} />
          </div>

          {/* ---- Pricing ---- */}
          <section id="pricing" className={`${card} scroll-mt-40`}>
            <div className="border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold text-fg">Tier pricing</h3>
              <p className="mt-0.5 text-xs text-muted">
                Cost and margin come from the cost per vial set in Inventory.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">Pack</th>
                  <th className="px-3 py-2 font-medium">Price (AUD)</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">Margin</th>
                  <th className="px-3 py-2 font-medium">Low-stock at</th>
                  <th className="px-5 py-2 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {product.variants.map((v) => {
                  const low = v.available <= v.low_stock_threshold;
                  // Margin follows the price being edited, so the effect of a
                  // price change is visible before it's saved.
                  const livePrice = Math.round((Number(form.prices[v.id]) || 0) * 100);
                  const cost = tierCostCents(product.unit_cost_cents, v.pack_size);
                  const m = marginOf(livePrice, cost);
                  return (
                    <tr key={v.id}>
                      <td className="px-5 py-3">
                        <span className="font-medium text-fg">{v.label}</span>
                        <span className="block font-mono text-xs text-muted-2">{v.sku}</span>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          inputMode="decimal"
                          value={form.prices[v.id] ?? ""}
                          onChange={(e) =>
                            set("prices", {
                              ...form.prices,
                              [v.id]: e.target.value.replace(/[^\d.]/g, ""),
                            })
                          }
                          className={`${field} max-w-[110px]`}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {cost == null ? "—" : formatAud(cost / 100)}
                      </td>
                      <td className="px-3 py-3">
                        {m.marginCents == null ? (
                          <span className="text-muted-2">—</span>
                        ) : (
                          <span className={m.marginCents < 0 ? "text-warn" : "text-success"}>
                            {formatAud(m.marginCents / 100)}
                            <span className="ml-1 text-xs opacity-80">({m.marginPct}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          inputMode="numeric"
                          value={form.thresholds[v.id] ?? ""}
                          onChange={(e) =>
                            set("thresholds", {
                              ...form.thresholds,
                              [v.id]: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          className={`${field} max-w-[90px]`}
                        />
                      </td>
                      <td className={`px-5 py-3 text-right ${low ? "text-warn" : "text-fg-2"}`}>
                        {v.available}
                        {v.reserved > 0 && (
                          <span className="block text-xs text-muted-2">{v.reserved} reserved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* ---- Inventory: ledger, NOT part of the save bar ---- */}
          <section id="inventory" className="scroll-mt-40 rounded-xl border border-accent/25 bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-accent/20 bg-accent/5 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">Inventory</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Stock is counted in vials; pack tiers draw from this one pool.
                </p>
              </div>
              <Badge tone="info">Applies immediately</Badge>
            </div>

            {pool ? (
              <div className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs text-muted">Vials on hand</span>
                    <span className={`text-2xl font-bold ${lowStock ? "text-warn" : "text-fg"}`}>
                      {vialsOnHand}
                    </span>
                  </div>
                  <button
                    onClick={() => setStockOpen(true)}
                    className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
                  >
                    Manage stock
                  </button>
                </div>

                <div className="rounded-lg border border-line bg-ink-2 p-3">
                  <p className="mb-1.5 text-xs text-muted">These vials can fill:</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    {product.variants.map((v) => (
                      <span key={v.id} className={v.available <= 0 ? "text-warn" : "text-fg-2"}>
                        <span className="font-semibold">{v.available}</span> × {v.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Cost per vial: one home, beside the stock it values. */}
                <div className="border-t border-line pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Cost per vial
                  </h4>
                  <p className="mb-2 mt-1 text-xs text-muted">
                    Weighted average of what you&apos;ve paid. Updates automatically when you enter a
                    cost on a stock receipt.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      inputMode="decimal"
                      placeholder={product.unit_cost_cents == null ? "not set" : ""}
                      value={costDraft}
                      onChange={(e) => setCostDraft(e.target.value.replace(/[^\d.]/g, ""))}
                      className={`${field} max-w-[140px]`}
                      aria-label="Cost per vial"
                    />
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await saveUnitCost(
                            product.slug,
                            costDraft.trim() === "" ? null : Number(costDraft),
                          );
                          if (res.ok) {
                            toast.success(res.message ?? "Cost updated");
                            router.refresh();
                          } else toast.error(res.error ?? "Failed");
                        })
                      }
                      className={`${btn} border border-line-2 bg-surface-2 text-fg`}
                    >
                      Set
                    </button>
                    {product.unit_cost_cents != null && (
                      <span className="text-xs text-muted-2">
                        Stock on hand at cost:{" "}
                        <span className="text-fg-2">
                          {formatAud((product.unit_cost_cents * vialsOnHand) / 100)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                This product has no 1-vial tier, so there is no stock pool to manage.
              </p>
            )}
          </section>

          {/* ---- SEO ---- */}
          <section id="seo" className={`${card} scroll-mt-40 p-5`}>
            <h3 className="mb-4 text-sm font-semibold text-fg">Search engine listing</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">SEO title</label>
                <input
                  value={form.seoTitle}
                  onChange={(e) => set("seoTitle", e.target.value)}
                  placeholder={product.name}
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Meta description</label>
                <textarea
                  rows={2}
                  value={form.seoDesc}
                  onChange={(e) => set("seoDesc", e.target.value)}
                  className={field}
                />
              </div>
              <SeoPreview
                title={form.seoTitle}
                description={form.seoDesc}
                slug={product.slug}
                fallbackTitle={form.name}
              />
            </div>
          </section>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="space-y-4">
          <section className={`${card} p-4 text-sm`}>
            <h3 className="mb-2 text-sm font-semibold text-fg">Storefront</h3>
            <a
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent-2 hover:underline"
            >
              View product page <ExternalLink size={13} />
            </a>
            <p className="mt-2 text-xs text-muted">Saving revalidates the storefront immediately.</p>
          </section>

          {waitlist > 0 && (
            <section className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
              <h3 className="mb-1 text-sm font-semibold text-accent">
                {waitlist} waiting for restock
              </h3>
              <p className="text-xs text-fg-2">
                Adding stock while this product is sold out automatically queues their back-in-stock
                emails.
              </p>
            </section>
          )}

          <section className={`${card} p-4 text-sm`}>
            <h3 className="mb-2 text-sm font-semibold text-fg">Summary</h3>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">SKU</dt>
                <dd className="font-mono text-fg-2">{product.sku}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Vials on hand</dt>
                <dd className="text-fg-2">{product.totalOnHand}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">From</dt>
                <dd className="text-fg-2">{formatAud(product.minPriceCents / 100)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tiers</dt>
                <dd className="text-fg-2">{product.variants.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {/* ---- Contextual save bar ---- */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          dirty ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-fg-2">
            Unsaved changes
            <span className="ml-2 text-xs text-muted">
              Stock changes are not part of this — they save on their own.
            </span>
          </p>
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => setForm(initial)}
              className={`${btn} border border-line-2 text-fg-2 hover:text-fg`}
            >
              Discard
            </button>
            <button
              disabled={pending}
              onClick={saveAll}
              className={`${btn} bg-accent px-5 text-accent-ink hover:brightness-95`}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <StockDrawer
        target={stockOpen ? stockTarget : null}
        onClose={() => setStockOpen(false)}
        initialMovements={movements}
      />
    </>
  );
}
