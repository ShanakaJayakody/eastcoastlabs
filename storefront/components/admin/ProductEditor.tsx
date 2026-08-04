"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { ProductDetail, MovementRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import {
  saveProductAll,
  adjustStock,
  duplicateProductAction,
} from "@/app/admin/(dashboard)/products/actions";
import RichTextEditor from "./RichTextEditor";
import ProductImages from "./ProductImages";
import SeoPreview from "./SeoPreview";

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "received", label: "Stock received" },
  { value: "recount", label: "Recount / correction" },
  { value: "adjustment", label: "Adjustment (damage, sample)" },
  { value: "return", label: "Customer return" },
];

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";
const btn = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";
const card = "rounded-xl border border-line bg-surface";

type Status = "active" | "draft" | "archived";

export default function ProductEditor({
  product,
  movements,
  waitlist,
}: {
  product: ProductDetail;
  movements: Record<string, MovementRow[]>;
  waitlist: number;
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

  // ---- Stock adjustments stay immediate: they're ledger entries, not edits ----
  // Stock lives once per product, in vials, on the 1-vial tier.
  const pool = product.variants.find((v) => v.pack_size === 1) ?? null;
  const vialsOnHand = pool?.on_hand ?? 0;

  const [adjQty, setAdjQty] = useState<Record<string, string>>({});
  const [adjReason, setAdjReason] = useState<Record<string, MovementReason>>({});
  const [adjNote, setAdjNote] = useState<Record<string, string>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  function applyStock(variantId: string) {
    const delta = Number(adjQty[variantId]);
    const reason = adjReason[variantId];
    start(async () => {
      const res = await adjustStock(product.slug, variantId, delta, reason, adjNote[variantId]);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      setAdjQty((s) => ({ ...s, [variantId]: "" }));
      setAdjNote((s) => ({ ...s, [variantId]: "" }));
      toast.success(res.message ?? "Stock updated", {
        action: {
          label: "Undo",
          onClick: () =>
            start(async () => {
              const back = await adjustStock(
                product.slug,
                variantId,
                -delta,
                "recount",
                "undo of previous adjustment",
              );
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

  function duplicate() {
    start(async () => {
      const res = await duplicateProductAction(product.slug);
      if (res.ok && res.slug) {
        toast.success(res.message ?? "Duplicated");
        router.push(`/admin/products/${res.slug}`);
      } else toast.error(res.error ?? "Duplicate failed");
    });
  }

  return (
    <>
      <div className="grid gap-6 pb-24 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---- Details ---- */}
          <section className={`${card} p-5`}>
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
          <ProductImages slug={product.slug} images={product.images} />

          {/* ---- Pricing (compact table) ---- */}
          <section className={card}>
            <div className="border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold text-fg">Tier pricing</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">Pack</th>
                  <th className="px-3 py-2 font-medium">Price (AUD)</th>
                  <th className="px-3 py-2 font-medium">Low-stock at</th>
                  <th className="px-5 py-2 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {product.variants.map((v) => {
                  const low = v.available <= v.low_stock_threshold;
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
                            set("prices", { ...form.prices, [v.id]: e.target.value.replace(/[^\d.]/g, "") })
                          }
                          className={`${field} max-w-[110px]`}
                        />
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

          {/* ---- Inventory: ONE pool of vials ---- */}
          <section className={card}>
            <div className="border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold text-fg">Inventory</h3>
              <p className="mt-0.5 text-xs text-muted">
                Stock is counted in vials. Pack tiers draw from this one pool — applied immediately
                and written to the stock ledger, not part of the save above.
              </p>
            </div>

            {pool ? (
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-fg">Vials on hand</span>
                  <span className="text-lg font-bold text-fg">{vialsOnHand}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_auto]">
                  <input
                    placeholder="+10"
                    value={adjQty[pool.id] ?? ""}
                    onChange={(e) =>
                      setAdjQty({ ...adjQty, [pool.id]: e.target.value.replace(/[^\d-]/g, "") })
                    }
                    className={field}
                    aria-label="Vial quantity change"
                  />
                  <select
                    value={adjReason[pool.id] ?? ""}
                    onChange={(e) =>
                      setAdjReason({ ...adjReason, [pool.id]: e.target.value as MovementReason })
                    }
                    className={field}
                    aria-label="Reason"
                  >
                    <option value="">Reason…</option>
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Note (optional)"
                    value={adjNote[pool.id] ?? ""}
                    onChange={(e) => setAdjNote({ ...adjNote, [pool.id]: e.target.value })}
                    className={field}
                  />
                  <button
                    disabled={pending || !adjQty[pool.id] || !adjReason[pool.id]}
                    onClick={() => applyStock(pool.id)}
                    className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
                  >
                    Apply
                  </button>
                </div>

                {/* What those vials mean per tier */}
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

                <button
                  onClick={() => setOpenHistory(openHistory === pool.id ? null : pool.id)}
                  className="text-xs text-accent-2 hover:underline"
                >
                  {openHistory === pool.id ? "Hide" : "Show"} movement history (
                  {movements[pool.id]?.length ?? 0})
                </button>
                {openHistory === pool.id && (
                  <ul className="space-y-1 rounded-lg border border-line bg-ink-2 p-3 text-xs">
                    {(movements[pool.id] ?? []).length === 0 ? (
                      <li className="text-muted">No movements recorded.</li>
                    ) : (
                      movements[pool.id].map((m, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className={m.qty > 0 ? "text-success" : "text-warn"}>
                            {m.qty > 0 ? "+" : ""}
                            {m.qty}
                          </span>
                          <span className="text-muted">{m.reason}</span>
                          <span className="flex-1 truncate text-muted-2">{m.note ?? ""}</span>
                          <span className="text-muted-2">{m.actor_email ?? "system"}</span>
                          <span className="whitespace-nowrap text-muted-2">
                            {new Date(m.created_at).toLocaleDateString("en-AU")}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                This product has no 1-vial tier, so there is no stock pool to manage.
              </p>
            )}
          </section>

          {/* ---- SEO ---- */}
          <section className={`${card} p-5`}>
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
          <section className={`${card} p-4`}>
            <h3 className="mb-2 text-sm font-semibold text-fg">Status</h3>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as Status)}
              className={field}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            {form.status !== "active" && (
              <p className="mt-2 text-xs text-warn">Not visible on the storefront.</p>
            )}
          </section>

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
              <h3 className="mb-1 text-sm font-semibold text-accent">{waitlist} waiting for restock</h3>
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
                <dt className="text-muted">Total on hand</dt>
                <dd className="text-fg-2">{product.totalOnHand}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">From</dt>
                <dd className="text-fg-2">{formatAud(product.minPriceCents / 100)}</dd>
              </div>
            </dl>
          </section>

          <button
            disabled={pending}
            onClick={duplicate}
            className={`${btn} flex w-full items-center justify-center gap-2 border border-line-2 bg-surface text-fg-2 hover:text-fg`}
          >
            <Copy size={14} /> Duplicate product
          </button>
        </div>
      </div>

      {/* ---- Contextual save bar ---- */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          dirty ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-fg-2">Unsaved changes</p>
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
    </>
  );
}
