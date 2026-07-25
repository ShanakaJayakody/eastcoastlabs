"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import Badge from "./Badge";
import { formatAud } from "@/lib/format";
import { createDiscount, toggleDiscount, deleteDiscount } from "@/app/admin/(dashboard)/discounts/actions";

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

export default function DiscountsManager({ discounts }: { discounts: DiscountRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
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
                      {d.used_count}
                      {d.usage_limit != null && <span className="text-muted"> / {d.usage_limit}</span>}
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
                          onClick={() => {
                            if (confirm(`Delete ${d.code}?`)) run(() => deleteDiscount(d.code));
                          }}
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
    </div>
  );
}
