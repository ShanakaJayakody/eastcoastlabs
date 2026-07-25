"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatAud } from "@/lib/format";
import type { ProductDetail, MovementRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import {
  saveProduct,
  saveVariantPrice,
  saveThreshold,
  adjustStock,
} from "@/app/admin/(dashboard)/products/actions";

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "received", label: "Stock received" },
  { value: "recount", label: "Recount / correction" },
  { value: "adjustment", label: "Adjustment (damage, sample)" },
  { value: "return", label: "Customer return" },
];

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";
const btn = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";

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

  const [name, setName] = useState(product.name);
  const [shortDesc, setShortDesc] = useState(product.short_description ?? "");
  const [desc, setDesc] = useState(product.description ?? "");
  const [seoTitle, setSeoTitle] = useState(product.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(product.seo_description ?? "");
  const [status, setStatus] = useState(product.status as "active" | "draft" | "archived");

  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [v.id, (v.price_cents / 100).toFixed(2)])),
  );
  const [thresholds, setThresholds] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [v.id, String(v.low_stock_threshold)])),
  );
  const [adjQty, setAdjQty] = useState<Record<string, string>>({});
  const [adjReason, setAdjReason] = useState<Record<string, MovementReason>>({});
  const [adjNote, setAdjNote] = useState<Record<string, string>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ---- Details ---- */}
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-fg">Details</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Short description (HTML)</label>
              <textarea
                rows={3}
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Full description (HTML)</label>
              <textarea rows={8} value={desc} onChange={(e) => setDesc(e.target.value)} className={field} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">SEO title</label>
                <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "draft" | "archived")}
                  className={field}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">SEO description</label>
              <textarea
                rows={2}
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                className={field}
              />
            </div>
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveProduct(product.slug, {
                    name,
                    short_description: shortDesc,
                    description: desc,
                    seo_title: seoTitle,
                    seo_description: seoDesc,
                    status,
                  }),
                )
              }
              className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
            >
              Save product
            </button>
          </div>
        </section>

        {/* ---- Variants: price, threshold, stock ---- */}
        <section className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <h3 className="text-sm font-semibold text-fg">Tier pricing & stock</h3>
          </div>
          <div className="divide-y divide-line">
            {product.variants.map((v) => {
              const low = v.available <= v.low_stock_threshold;
              return (
                <div key={v.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="font-medium text-fg">{v.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted">{v.sku}</span>
                    </div>
                    <span className={`text-sm ${low ? "text-warn" : "text-muted"}`}>
                      {v.available} available
                      {v.reserved > 0 && ` · ${v.reserved} reserved`}
                      {" · "}
                      {v.on_hand} on hand
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs text-muted">Price (AUD)</label>
                      <input
                        value={prices[v.id] ?? ""}
                        onChange={(e) => setPrices({ ...prices, [v.id]: e.target.value })}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Low-stock threshold</label>
                      <input
                        value={thresholds[v.id] ?? ""}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, [v.id]: e.target.value.replace(/\D/g, "") })
                        }
                        className={field}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(() => saveVariantPrice(product.slug, v.id, Number(prices[v.id])))
                        }
                        className={`${btn} border border-line-2 bg-surface-2 text-fg`}
                      >
                        Save price
                      </button>
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(() => saveThreshold(product.slug, v.id, Number(thresholds[v.id] || 0)))
                        }
                        className={`${btn} border border-line-2 text-fg-2 hover:text-fg`}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Stock adjustment — reason is mandatory */}
                  <div className="grid gap-2 rounded-lg border border-line bg-ink-2 p-3 sm:grid-cols-[90px_1fr_1fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs text-muted">Qty ±</label>
                      <input
                        placeholder="+10"
                        value={adjQty[v.id] ?? ""}
                        onChange={(e) =>
                          setAdjQty({ ...adjQty, [v.id]: e.target.value.replace(/[^\d-]/g, "") })
                        }
                        className={field}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Reason (required)</label>
                      <select
                        value={adjReason[v.id] ?? ""}
                        onChange={(e) =>
                          setAdjReason({ ...adjReason, [v.id]: e.target.value as MovementReason })
                        }
                        className={field}
                      >
                        <option value="">Choose…</option>
                        {REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Note</label>
                      <input
                        value={adjNote[v.id] ?? ""}
                        onChange={(e) => setAdjNote({ ...adjNote, [v.id]: e.target.value })}
                        className={field}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        disabled={pending || !adjQty[v.id] || !adjReason[v.id]}
                        onClick={() =>
                          run(async () => {
                            const res = await adjustStock(
                              product.slug,
                              v.id,
                              Number(adjQty[v.id]),
                              adjReason[v.id],
                              adjNote[v.id],
                            );
                            if (res.ok) {
                              setAdjQty({ ...adjQty, [v.id]: "" });
                              setAdjNote({ ...adjNote, [v.id]: "" });
                            }
                            return res;
                          })
                        }
                        className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenHistory(openHistory === v.id ? null : v.id)}
                    className="text-xs text-accent-2 hover:underline"
                  >
                    {openHistory === v.id ? "Hide" : "Show"} movement history (
                    {movements[v.id]?.length ?? 0})
                  </button>
                  {openHistory === v.id && (
                    <ul className="space-y-1 rounded-lg border border-line bg-ink-2 p-3 text-xs">
                      {(movements[v.id] ?? []).length === 0 ? (
                        <li className="text-muted">No movements recorded.</li>
                      ) : (
                        movements[v.id].map((m, i) => (
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
              );
            })}
          </div>
        </section>
      </div>

      {/* ---- Sidebar ---- */}
      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-fg">Storefront</h3>
          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent-2 hover:underline"
          >
            View product page ↗
          </a>
          <p className="mt-2 text-xs text-muted">
            Saving revalidates the storefront, so changes appear immediately.
          </p>
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

        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
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
      </div>
    </div>
  );
}
