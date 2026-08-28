"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import type { MovementRow, VariantRow } from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import { adjustStock, fetchMovements } from "@/app/admin/(dashboard)/products/actions";

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
  /** Preloaded history (editor); omit and the drawer fetches its own (list). */
  initialMovements,
}: {
  target: StockTarget | null;
  onClose: () => void;
  initialMovements?: MovementRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<MovementReason | "">("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");

  const [movements, setMovements] = useState<MovementRow[] | null>(initialMovements ?? null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const open = target !== null;

  // Reset the form whenever the drawer points at a different product.
  useEffect(() => {
    setQty("");
    setReason("");
    setNote("");
    setCost("");
    setMovements(initialMovements ?? null);
  }, [target?.poolId, initialMovements]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!target) return null;

  function loadHistory() {
    if (!target || movements !== null) return;
    setLoadingHistory(true);
    fetchMovements(target.poolId)
      .then(setMovements)
      .catch(() => toast.error("Could not load history"))
      .finally(() => setLoadingHistory(false));
  }

  function apply() {
    const t = target!;
    const delta = Number(qty);
    const r = reason as MovementReason;
    start(async () => {
      const res = await adjustStock(t.slug, t.poolId, delta, r, note || undefined, Number(cost) || null);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      setQty("");
      setNote("");
      setCost("");
      setMovements(null);
      toast.success(res.message ?? "Stock updated", {
        action: {
          label: "Undo",
          onClick: () =>
            start(async () => {
              const back = await adjustStock(
                t.slug,
                t.poolId,
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

  const projected = qty ? target.vialsOnHand + (Number(qty) || 0) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={() => !pending && onClose()}
      />
      <div className="admin-enter relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-fg">Stock — {target.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              Counted in vials. Every change writes to the ledger immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close stock panel"
            className="rounded-md p-1 text-muted transition hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-baseline justify-between rounded-lg border border-line bg-ink-2 px-4 py-3">
            <span className="text-sm text-fg-2">Vials on hand</span>
            <span className="text-2xl font-bold tabular-nums text-fg">
              {target.vialsOnHand}
              {projected !== null && projected !== target.vialsOnHand && (
                <span className="ml-2 text-sm font-medium text-accent">→ {projected}</span>
              )}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs text-muted">Change (+ receive, − remove)</label>
              <input
                autoFocus
                placeholder="+10"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d-]/g, ""))}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Reason</label>
              <select
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
              <label className="mb-1 block text-xs text-muted">Note (optional)</label>
              <input
                placeholder="Supplier, batch, who counted it…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={field}
              />
            </div>

            {/* Cost only makes sense on inbound stock. */}
            {reason === "received" && (
              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
                <label className="mb-1 block text-xs font-medium text-fg-2">
                  Cost per vial (what you paid) — optional
                </label>
                <input
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
              {pending ? "Applying…" : "Apply to ledger"}
            </button>
          </div>

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

          <div>
            <button
              onClick={loadHistory}
              className="flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
            >
              <History size={13} />
              {movements === null ? "Show movement history" : `Movement history (${movements.length})`}
              {loadingHistory && <Loader2 size={12} className="animate-spin" />}
            </button>
            {movements !== null && (
              <ul className="mt-2 space-y-1 rounded-lg border border-line bg-ink-2 p-3 text-xs">
                {movements.length === 0 ? (
                  <li className="text-muted">No movements recorded.</li>
                ) : (
                  movements.map((m, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className={m.qty > 0 ? "text-success" : "text-warn"}>
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </span>
                      <span className="text-muted">{m.reason}</span>
                      <span className="flex-1 truncate text-muted-2">{m.note ?? ""}</span>
                      <span className="whitespace-nowrap text-muted-2">
                        {new Date(m.created_at).toLocaleDateString("en-AU")}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
