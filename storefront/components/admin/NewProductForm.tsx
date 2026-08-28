"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatAud } from "@/lib/format";
import { createProductAction, saveUnitCost } from "@/app/admin/(dashboard)/products/actions";

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";

/** Mirrors TIER_DISCOUNTS server-side (3-pack 15% off, 6-pack 25% off). */
const suggest = (single: number, pack: number, off: number) =>
  single > 0 ? Math.round((single * pack * (1 - off)) / 1) : 0;

/** Chip marking a field that is still following the 1-vial price. */
function AutoChip() {
  return (
    <span className="ml-1.5 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent">
      auto
    </span>
  );
}

export default function NewProductForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [compound, setCompound] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [single, setSingle] = useState("");
  const [stock, setStock] = useState("");
  const [cost, setCost] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  // Pack prices auto-follow the 1-vial price until the operator overrides them.
  const [p3Override, setP3Override] = useState<string | null>(null);
  const [p6Override, setP6Override] = useState<string | null>(null);

  const singleNum = Number(single) || 0;
  const auto3 = useMemo(() => suggest(singleNum, 3, 0.15), [singleNum]);
  const auto6 = useMemo(() => suggest(singleNum, 6, 0.25), [singleNum]);
  const p3 = p3Override ?? (auto3 ? String(auto3) : "");
  const p6 = p6Override ?? (auto6 ? String(auto6) : "");

  const costNum = Number(cost) || 0;
  const stockNum = Number(stock) || 0;

  const slugPreview = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  /** Per-tier margin so a bad price is visible before the product exists. */
  const tiers = [
    { label: "1 vial", packs: 1, price: singleNum },
    { label: "3-pack", packs: 3, price: Number(p3) || 0 },
    { label: "6-pack", packs: 6, price: Number(p6) || 0 },
  ].map((t) => {
    const tierCost = costNum * t.packs;
    const margin = t.price - tierCost;
    return {
      ...t,
      tierCost,
      margin,
      pct: t.price > 0 ? Math.round((margin / t.price) * 100) : 0,
    };
  });

  function submit() {
    if (!name.trim()) return toast.error("Product name is required.");
    if (singleNum <= 0) return toast.error("Enter a 1-vial price.");
    start(async () => {
      const res = await createProductAction({
        name,
        compound,
        shortDescription,
        singlePriceAud: singleNum,
        pack3PriceAud: Number(p3) || 0,
        pack6PriceAud: Number(p6) || 0,
        initialStock: stockNum,
        status,
      });
      if (!res.ok || !res.slug) {
        toast.error(res.error ?? "Could not create product");
        return;
      }
      // Cost is a separate concern from creation, so it's stamped on straight
      // after rather than widening the create action's contract.
      if (costNum > 0) await saveUnitCost(res.slug, costNum);
      toast.success(res.message ?? "Created");
      router.push(`/admin/products/${res.slug}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-fg">Details</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Product name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ipamorelin"
                className={field}
              />
              {slugPreview && (
                <p className="mt-1 text-xs text-muted-2">
                  URL: /product/<span className="text-fg-2">{slugPreview}</span> · SKU and pack SKUs
                  are generated automatically
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Compound (optional)</label>
              <input
                value={compound}
                onChange={(e) => setCompound(e.target.value)}
                placeholder="e.g. Ipamorelin 10mg"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Short description (optional)</label>
              <textarea
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One or two lines shown on the product card and PDP intro."
                className={field}
              />
              <p className="mt-1 text-xs text-muted-2">
                Full description, images and SEO are edited on the next screen.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Tier pricing</h3>
          <p className="mb-4 mt-1 text-xs text-muted">
            Enter the 1-vial price — the 3-pack (15% off) and 6-pack (25% off) fill in
            automatically. Override either if this product prices differently.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">1 vial (AUD)</label>
              <input
                inputMode="decimal"
                value={single}
                onChange={(e) => setSingle(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="59.99"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center text-xs text-muted">
                3-pack
                {p3Override === null && auto3 > 0 && <AutoChip />}
              </label>
              <input
                inputMode="decimal"
                value={p3}
                onChange={(e) => setP3Override(e.target.value.replace(/[^\d.]/g, ""))}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center text-xs text-muted">
                6-pack
                {p6Override === null && auto6 > 0 && <AutoChip />}
              </label>
              <input
                inputMode="decimal"
                value={p6}
                onChange={(e) => setP6Override(e.target.value.replace(/[^\d.]/g, ""))}
                className={field}
              />
            </div>
          </div>
          {(p3Override !== null || p6Override !== null) && (
            <button
              onClick={() => {
                setP3Override(null);
                setP6Override(null);
              }}
              className="mt-3 text-xs text-accent-2 hover:underline"
            >
              Reset to suggested pricing
            </button>
          )}

          {/* Live margin — catches an underpriced tier before it goes live. */}
          {costNum > 0 && singleNum > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-ink-2 p-3">
              <p className="mb-2 text-xs text-muted">
                Margin at {formatAud(costNum)}/vial cost:
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                {tiers.map((t) => (
                  <span key={t.label} className="text-muted">
                    {t.label}:{" "}
                    <span className={t.margin < 0 ? "font-semibold text-warn" : "font-semibold text-success"}>
                      {formatAud(t.margin)}
                    </span>
                    {t.price > 0 && <span className="ml-1 opacity-70">({t.pct}%)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Inventory</h3>
          <p className="mb-3 mt-1 text-xs text-muted">
            Stock is counted in vials and held as one pool — pack tiers draw from it rather than
            holding stock of their own.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Opening stock (vials)</label>
              <input
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-2">
                Recorded in the ledger as &ldquo;received&rdquo;. Leave blank to start at zero.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Cost per vial (optional)</label>
              <input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="e.g. 18.50"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-2">
                What you paid. Drives the margin figures above.
              </p>
            </div>
          </div>

          {stockNum > 0 && (
            <div className="mt-3 rounded-lg border border-line bg-ink-2 p-3 text-xs">
              <span className="text-muted">{stockNum} vials can fill: </span>
              <span className="text-fg-2">
                {stockNum} × 1 vial · {Math.floor(stockNum / 3)} × 3-pack ·{" "}
                {Math.floor(stockNum / 6)} × 6-pack
              </span>
              {costNum > 0 && (
                <span className="ml-2 text-muted">
                  · stock at cost {formatAud(stockNum * costNum)}
                </span>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Status</h3>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "active")}
            className={field}
          >
            <option value="draft">Draft — hidden from the storefront</option>
            <option value="active">Active — live immediately</option>
          </select>
          <p className="mt-2 text-xs text-muted">
            Drafts let you finish images and copy before shoppers can see the product.
          </p>
        </section>

        <button
          disabled={pending}
          onClick={submit}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create product"}
        </button>
        <p className="text-center text-xs text-muted-2">
          You&apos;ll land in the full editor to add images and description.
        </p>
      </div>
    </div>
  );
}
