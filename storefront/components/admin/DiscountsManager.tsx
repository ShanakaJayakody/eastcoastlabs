"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import Badge from "./Badge";
import { formatAud } from "@/lib/format";
import { createDiscount, toggleDiscount, deleteDiscount } from "@/app/admin/(dashboard)/discounts/actions";
import ConfirmModal from "./ConfirmModal";

export interface DiscountRow {
  code: string;
  kind: "percent" | "fixed";
  percent: number | null;
  value_cents: number | null;
  min_spend_cents: number;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
}

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

export interface Redemption {
  orders: number;
  revenueCents: number;
}

export default function DiscountsManager({
  discounts,
  redeemed = {},
}: {
  discounts: DiscountRow[];
  /** Real redemptions per code, keyed uppercase. */
  redeemed?: Record<string, Redemption>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    kind: "percent" as "percent" | "fixed",
    amount: "10",
    minSpendAud: "0",
    usageLimit: "",
    expiresAt: "",
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{discounts.length} codes</p>
        <button
          onClick={() => setShow((v) => !v)}
          className={`${btn} flex items-center gap-1.5 border border-line-2 bg-surface text-fg-2 hover:text-fg`}
        >
          <Plus size={15} /> New code
        </button>
      </div>

      {show && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Create a discount code</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="CODE"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={`${field} font-mono`}
            />
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}
              className={field}
            >
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
            <input
              placeholder={form.kind === "percent" ? "10 (%)" : "25 ($)"}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })}
              className={field}
            />
            <div>
              <label className="mb-1 block text-xs text-muted">Minimum spend (AUD)</label>
              <input
                value={form.minSpendAud}
                onChange={(e) => setForm({ ...form, minSpendAud: e.target.value.replace(/[^\d.]/g, "") })}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Usage limit (blank = unlimited)</label>
              <input
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value.replace(/\D/g, "") })}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Expires (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={field}
              />
            </div>
          </div>
          <button
            disabled={pending || !form.code}
            onClick={() =>
              run(async () => {
                const res = await createDiscount({
                  code: form.code,
                  kind: form.kind,
                  amount: Number(form.amount),
                  minSpendAud: Number(form.minSpendAud || 0),
                  usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
                  expiresAt: form.expiresAt || null,
                });
                if (res.ok) {
                  setForm({ ...form, code: "", usageLimit: "", expiresAt: "" });
                  setShow(false);
                }
                return res;
              })
            }
            className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
          >
            Create code
          </button>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {discounts.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">No discount codes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Discount</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Min spend</th>
                <th className="px-4 py-2.5 font-medium">Used</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Revenue</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Expires</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {discounts.map((d) => {
                const exhausted = d.usage_limit != null && d.used_count >= d.usage_limit;
                return (
                  <tr key={d.code} className="transition hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-accent">{d.code}</td>
                    <td className="px-4 py-3 text-fg-2">
                      {d.kind === "percent" ? `${d.percent}% off` : `${formatAud((d.value_cents ?? 0) / 100)} off`}
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {d.min_spend_cents ? formatAud(d.min_spend_cents / 100) : "—"}
                    </td>
                    <td className="px-4 py-3 text-fg-2">
                      {(() => {
                        const stats = redeemed[d.code.toUpperCase()];
                        if (!stats) return <span className="text-muted-2">0</span>;
                        return (
                          <Link
                            href={`/admin/orders?status=all&discount=${encodeURIComponent(d.code)}`}
                            className="text-accent-2 hover:underline"
                            title={`See the ${stats.orders} paid order${stats.orders === 1 ? "" : "s"} that used ${d.code}`}
                          >
                            {stats.orders}
                          </Link>
                        );
                      })()}
                      {d.usage_limit != null && <span className="text-muted"> / {d.usage_limit}</span>}
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-muted md:table-cell">
                      {(() => {
                        const stats = redeemed[d.code.toUpperCase()];
                        return stats ? formatAud(stats.revenueCents / 100) : "—";
                      })()}
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {d.expires_at ? new Date(d.expires_at).toLocaleDateString("en-AU") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={!d.active ? "neutral" : exhausted ? "warn" : "success"}>
                        {!d.active ? "disabled" : exhausted ? "limit reached" : "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={pending}
                          onClick={() => run(() => toggleDiscount(d.code, !d.active))}
                          className="text-xs text-fg-2 hover:text-fg"
                        >
                          {d.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => setDeleting(d.code)}
                          className="text-muted hover:text-red-400"
                          aria-label={`Delete ${d.code}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        Codes apply at checkout. <span className="font-mono text-fg-2">WELCOME10</span> is the code
        your exit-intent modal promises new visitors.
      </p>

      <ConfirmModal
        open={deleting !== null}
        title="Delete this discount code?"
        body={
          deleting && (
            <>
              <p className="font-mono font-medium text-fg">{deleting}</p>
              <p className="mt-1.5 text-muted">
                {(() => {
                  const row = discounts.find((d) => d.code === deleting);
                  const used = row?.used_count ?? 0;
                  return used > 0
                    ? `Used ${used} time${used === 1 ? "" : "s"} already. Deleting removes the code entirely — anyone who still has it will get "invalid code" at checkout. Disabling it instead keeps the history intact.`
                    : "Never used. Deleting removes it entirely; anyone holding the code will get \u201cinvalid code\u201d at checkout.";
                })()}
              </p>
            </>
          )
        }
        confirmLabel="Delete code"
        tone="danger"
        pending={pending}
        onConfirm={() => {
          const code = deleting;
          if (!code) return;
          setDeleting(null);
          run(() => deleteDiscount(code));
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
