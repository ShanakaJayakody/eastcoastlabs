"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { History, Loader2, UserRound, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { MovementRow, VariantRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import { adjustStock, reverseReceipt, fetchMovements } from "@/app/admin/(dashboard)/products/actions";

import {useDialogFocus} from "./useDialogFocus";
import StockHistory from "./StockHistory";

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "received", label: "Stock received" },
  { value: "recount", label: "Recount / correction" },
  { value: "adjustment", label: "Adjustment (damage, sample)" },
  { value: "return", label: "Customer return" },
];

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";

export interface StockTarget {
  slug: string;
  name: string;
  /** The 1-vial variant — the only place stock actually lives. */
  poolId: string;
  vialsOnHand: number;
  unitCostCents: number | null;
  variants: VariantRow[];
}

/**
 * One place to move stock, used by both the products list and the product
 * editor. Everything here writes to the ledger immediately — it is deliberately
 * separate from any form save, so the two never look like one action.
 */
export default function StockDrawer({
  target,
  onClose,
  /** Preloaded receipt history (editor); otherwise fetched when opened. */
  initialMovements,
  adminName,
}: {
  target: StockTarget | null;
  onClose: () => void;
  initialMovements?: MovementRow[];
  adminName?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<MovementReason | "">("received");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");

  const [movements, setMovements] = useState<MovementRow[] | null>(initialMovements ?? null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [receiptsOnly, setReceiptsOnly] = useState(true);
  const [historyRevision, setHistoryRevision] = useState(0);
  const fieldId = useId();
  const poolId = target?.poolId;

  const open = target !== null;

  // Reset the form whenever the drawer points at a different product.
  useEffect(() => {
    setQty("");
    setReason("received");
    setNote("");
    setCost("");
    setReceiptsOnly(true);
    setHistoryRevision(0);
  }, [poolId]);

  useEffect(() => {
    if (!poolId) return;
    let cancelled = false;
    setHistoryError(null);
    if (initialMovements && receiptsOnly && historyRevision === 0) {
      setMovements(initialMovements);
      setLoadingHistory(false);
      return;
    }
    setMovements(null);
    setLoadingHistory(true);
    fetchMovements(poolId, receiptsOnly)
      .then(rows => { if (!cancelled) setMovements(rows); })
      .catch(() => { if (!cancelled) setHistoryError("Stock history could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [poolId, initialMovements, receiptsOnly, historyRevision]);

  const dialogRef=useRef<HTMLDivElement>(null);
  useDialogFocus(open,dialogRef,onClose,pending);

  if (!target) return null;

  function apply() {
    const t = target!;
    const delta = Number(qty);
    const r = reason as MovementReason;
    start(async () => {
      const res = await adjustStock(t.slug, t.poolId, delta, r, note || undefined, cost.trim() ? Number(cost) : null);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      setQty("");
      setNote("");
      setCost("");
      setHistoryRevision(value => value + 1);
      (res.warning ? toast.warning : toast.success)(res.message ?? "Stock updated", {
        description: res.warning,
        action: {
          label: res.receiptId ? "Reverse receipt" : "Reverse quantity",
          onClick: () =>
            start(async () => {
              const back = res.receiptId ? await reverseReceipt(t.slug,res.receiptId) : await adjustStock(
                t.slug,
                t.poolId,
                -delta,
                "recount",
                "undo of previous adjustment",
              );
              if (back.ok) {
                (back.warning ? toast.warning : toast.success)(back.message ?? "Quantity reversed; previously queued notifications are unchanged.",{description:back.warning});
                setHistoryRevision(value => value + 1);
                router.refresh();
              } else toast.error(back.error ?? "Undo failed");
            }),
        },
      });
      router.refresh();
    });
  }

  const projected = qty ? target.vialsOnHand + (Number(qty) || 0) : null;
  const latestReceipt = receiptsOnly ? movements?.[0] : null;

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Stock — ${target.name}`}>
      <div
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={() => !pending && onClose()}
      />
      <div className="admin-enter relative flex h-full w-full max-w-4xl flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">Stock — {target.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              Receive stock and see who added each delivery.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label="Close stock panel"
            className="rounded-md p-1 text-muted transition hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {latestReceipt && <button type="button" onClick={() => document.getElementById(`${fieldId}-history`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mb-4 block w-full rounded-xl border border-accent/30 bg-accent/5 p-4 text-left md:hidden">
            <span className="block text-xs text-muted">Latest stock receipt</span>
            <span className="mt-1 block break-words text-base font-semibold text-fg">{`${latestReceipt.actor_name || (latestReceipt.actor_email ? "Name not set" : "Admin not recorded")} · +${latestReceipt.qty.toLocaleString("en-AU")} vials${latestReceipt.reversed ? " · Reversed" : ""}`}</span>
            <span className="mt-2 block text-xs font-medium text-accent underline">View stock history</span>
          </button>}
          <div className="grid items-start gap-6 md:grid-cols-2">
          <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <span className="rounded-full bg-accent/15 p-3 text-accent" aria-hidden="true"><UserRound size={22}/></span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-2">Recording stock as</p>
              <p className="mt-0.5 break-words text-lg font-semibold text-fg">{adminName || "Name not set"}</p>
              {adminName ? <p className="mt-1 text-xs text-muted">Your name will appear on this stock entry.</p>
                : <Link href="/admin/settings#admin-names" className="mt-1 block text-xs font-medium text-accent underline">Set your display name in Settings</Link>}
            </div>
          </div>
          <div className="flex items-baseline justify-between rounded-lg border border-line bg-ink-2 px-4 py-3">
            <span className="text-sm text-fg-2">Vials on hand</span>
            <span className="text-2xl font-bold tabular-nums text-fg">
              {target.vialsOnHand}
              {projected !== null && projected !== target.vialsOnHand && (
                <span className="ml-2 text-sm font-medium text-accent">→ {projected}</span>
              )}
            </span>
          </div>

          <fieldset disabled={pending} className="space-y-3">
            <legend className="mb-3 text-sm font-semibold text-fg">Record a stock change</legend>
            <div>
              <label htmlFor={`${fieldId}-quantity`} className="mb-1 block text-xs text-muted">Change (+ receive, − remove)</label>
              <input
                id={`${fieldId}-quantity`}
                inputMode="numeric"
                placeholder="+10"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d-]/g, ""))}
                className={field}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-reason`} className="mb-1 block text-xs text-muted">Reason</label>
              <select
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value as MovementReason)}
                className={field}
              >
                <option value="">Choose a reason…</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${fieldId}-note`} className="mb-1 block text-xs text-muted">Note (optional)</label>
              <input
                id={`${fieldId}-note`}
                placeholder="Supplier, batch, who counted it…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={field}
              />
            </div>

            {/* Cost only makes sense on inbound stock. */}
            {reason === "received" && (
              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
                <label htmlFor={`${fieldId}-cost`} className="mb-1 block text-xs font-medium text-fg-2">
                  Cost per vial (what you paid) — optional
                </label>
                <input
                  id={`${fieldId}-cost`}
                  inputMode="decimal"
                  placeholder="e.g. 18.50"
                  value={cost}
                  onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                  className={field}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Updates the weighted-average cost
                  {target.unitCostCents != null && (
                    <> (currently {formatAud(target.unitCostCents / 100)}/vial)</>
                  )}
                  . Leave blank to keep it.
                </p>
              </div>
            )}

            <button
              disabled={pending || !qty || !reason}
              onClick={apply}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
            >
              {pending ? "Saving…" : reason === "received" ? "Receive stock" : "Save stock change"}
            </button>
            <p className="text-xs text-muted">Stock updates immediately when you save.</p>
          </fieldset>

          {/* What those vials mean per tier */}
          <div className="rounded-lg border border-line bg-ink-2 p-3">
            <p className="mb-1.5 text-xs text-muted">These vials can fill:</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {target.variants.map((v) => (
                <span key={v.id} className={v.available <= 0 ? "text-warn" : "text-fg-2"}>
                  <span className="font-semibold">{v.available}</span> × {v.label}
                </span>
              ))}
            </div>
          </div>
          </div>

          <section className="min-w-0 border-t border-line pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0" aria-labelledby={`${fieldId}-history`}>
            <h3 id={`${fieldId}-history`} className="flex items-center gap-2 text-base font-semibold text-fg"><History size={18} className="text-accent"/>Who added stock</h3>
            <p className="mb-4 mt-1 text-xs text-muted">Names, quantities and dates for the latest 20 entries.</p>
            <div className="mb-4 flex gap-1 rounded-lg border border-line bg-ink-2 p-1" aria-label="History filter">
              {([{value:true,label:"Stock received"},{value:false,label:"All movements"}]).map(filter => <button key={filter.label} type="button" aria-pressed={receiptsOnly === filter.value}
                onClick={() => setReceiptsOnly(filter.value)} className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold ${receiptsOnly === filter.value ? "bg-surface-2 text-fg shadow-sm" : "text-muted hover:text-fg"}`}>{filter.label}</button>)}
            </div>
            {loadingHistory && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={16} className="animate-spin"/>Loading stock history…</p>}
            {historyError && <div role="alert" className="rounded-lg border border-line p-4 text-sm text-fg-2"><p>{historyError}</p><button type="button" onClick={() => setHistoryRevision(value => value + 1)} className="mt-2 font-medium text-accent underline">Try again</button></div>}
            {!loadingHistory && !historyError && movements?.length === 0 && <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">{receiptsOnly ? "No stock receipts recorded yet." : "No stock movements recorded yet."}</p>}
            {!loadingHistory && !historyError && movements && <StockHistory movements={movements} productName={target.name}/>}
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
