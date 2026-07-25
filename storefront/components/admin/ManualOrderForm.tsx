"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import { createManualOrder } from "@/app/admin/(dashboard)/orders/new/actions";

export interface VariantOption {
  id: string;
  label: string; // "BPC-157 · 3-pack (ECL-BPC-157-10-3)"
  priceCents: number;
  available: number;
}

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const btn = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";
const cents = (c: number) => formatAud(c / 100);

export default function ManualOrderForm({ variants }: { variants: VariantOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    suburb: "",
    state: "NSW",
    postcode: "",
    phone: "",
  });
  const [picked, setPicked] = useState<{ variantId: string; qty: number }[]>([]);
  const [sel, setSel] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [discountCode, setDiscountCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [markPaidNow, setMarkPaidNow] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const subtotal = picked.reduce((s, p) => s + (byId.get(p.variantId)?.priceCents ?? 0) * p.qty, 0);

  const add = () => {
    const n = Math.max(1, parseInt(qty, 10) || 1);
    if (!sel) return;
    setPicked((prev) => {
      const found = prev.find((p) => p.variantId === sel);
      return found
        ? prev.map((p) => (p.variantId === sel ? { ...p, qty: p.qty + n } : p))
        : [...prev, { variantId: sel, qty: n }];
    });
    setQty("1");
  };

  const submit = () =>
    start(async () => {
      const res = await createManualOrder({
        email,
        name,
        address,
        items: picked,
        discountCode,
        paymentMethod,
        markPaidNow,
        paymentRef,
      });
      if (res.ok) {
        toast.success(`Order ${res.orderNumber} created`);
        router.push(`/admin/orders/${res.orderId}`);
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-fg">Customer</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
            <input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-fg">Shipping address</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Street address"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
            <input
              placeholder="Suburb"
              value={address.suburb}
              onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
              className={field}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className={field}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                placeholder="Postcode"
                value={address.postcode}
                onChange={(e) => setAddress({ ...address, postcode: e.target.value.replace(/\D/g, "") })}
                className={field}
              />
            </div>
            <input
              placeholder="Phone (optional)"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-fg">Items</h3>
          <div className="flex flex-wrap gap-2">
            <select value={sel} onChange={(e) => setSel(e.target.value)} className={`${field} flex-1`}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {cents(v.priceCents)} ({v.available} avail)
                </option>
              ))}
            </select>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
              className={`${field} w-20`}
            />
            <button onClick={add} className={`${btn} border border-line-2 bg-surface-2 text-fg`}>
              <Plus size={15} />
            </button>
          </div>

          {picked.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {picked.map((p) => {
                const v = byId.get(p.variantId);
                return (
                  <li key={p.variantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-fg-2">{v?.label}</span>
                    <span className="text-muted">
                      {cents(v?.priceCents ?? 0)} × {p.qty}
                    </span>
                    <button
                      onClick={() => setPicked(picked.filter((x) => x.variantId !== p.variantId))}
                      className="text-muted hover:text-fg"
                      aria-label="Remove item"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-fg">Payment</h3>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={field}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="phone">Phone / card taken offline</option>
            <option value="other">Other</option>
          </select>
          <input
            placeholder="Discount code (optional)"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            className={`${field} mt-3`}
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-fg-2">
            <input
              type="checkbox"
              checked={markPaidNow}
              onChange={(e) => setMarkPaidNow(e.target.checked)}
              className="accent-accent"
            />
            Payment already received
          </label>
          {markPaidNow && (
            <input
              placeholder="Payment reference"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className={`${field} mt-2`}
            />
          )}

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items subtotal</dt>
              <dd className="text-fg-2">{cents(subtotal)}</dd>
            </div>
            <p className="text-xs text-muted-2">
              Final totals (discount, shipping) are computed server-side when the order is created.
            </p>
          </dl>

          <button
            disabled={pending || !picked.length}
            onClick={submit}
            className={`${btn} mt-4 w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            {pending ? "Creating…" : markPaidNow ? "Create & mark paid" : "Create order"}
          </button>
        </div>
      </aside>
    </div>
  );
}
