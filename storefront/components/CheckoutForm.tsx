"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatAud } from "@/lib/format";
import { placeOrder, quoteCart, captureCartEmail, type CheckoutAddress } from "@/app/(store)/checkout/actions";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

interface Quote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  giftApplied: boolean;
  discountError?: string;
  warnings: string[];
}

const cents = (c: number) => formatAud(c / 100);

export default function CheckoutForm() {
  const router = useRouter();
  const { lines, ready, clear } = useCart();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState<CheckoutAddress>({
    line1: "",
    line2: "",
    suburb: "",
    state: "NSW",
    postcode: "",
    country: "AU",
    phone: "",
  });
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Totals always come from the server — the same numbers the order is written
  // with, so what the shopper sees is what gets charged.
  useEffect(() => {
    if (!ready || lines.length === 0) return;
    let cancelled = false;
    const payload = lines.map((l) => ({
      key: l.key,
      slug: l.slug,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
    }));
    quoteCart(payload, appliedCode || undefined)
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lines, ready, appliedCode]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await placeOrder({
        email,
        name,
        address,
        discountCode: appliedCode || undefined,
        lines: lines.map((l) => ({
          key: l.key,
          slug: l.slug,
          variantLabel: l.variantLabel,
          quantity: l.quantity,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      clear();
      router.push(`/checkout/thank-you?order=${encodeURIComponent(res.orderNumber)}`);
    });
  }

  if (ready && lines.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-fg">Your cart is empty.</p>
        <Link
          href="/shop"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
        >
          Browse research peptides
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-fg outline-none transition focus:border-accent";

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* ---- Details ---- */}
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                // Best-effort abandoned-cart capture — never blocks or errors checkout.
                if (email.includes("@") && lines.length) {
                  void captureCartEmail(
                    email,
                    lines.map((l) => ({ key: l.key, slug: l.slug, variantLabel: l.variantLabel, quantity: l.quantity })),
                  );
                }
              }}
              className={`${field} sm:col-span-2`}
            />
            <input
              required
              placeholder="Full name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${field} sm:col-span-2`}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Shipping address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Street address"
              autoComplete="address-line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
            <input
              placeholder="Apartment, unit (optional)"
              autoComplete="address-line2"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
            <input
              required
              placeholder="Suburb"
              autoComplete="address-level2"
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
                required
                inputMode="numeric"
                maxLength={4}
                placeholder="Postcode"
                autoComplete="postal-code"
                value={address.postcode}
                onChange={(e) =>
                  setAddress({ ...address, postcode: e.target.value.replace(/\D/g, "") })
                }
                className={field}
              />
            </div>
            <input
              placeholder="Phone (optional)"
              autoComplete="tel"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold text-fg">Payment</h2>
          <p className="text-sm text-muted">
            Your order is placed now and we email bank-transfer details immediately.
            Card payment is coming shortly — nothing is charged on this page.
          </p>
        </section>
      </div>

      {/* ---- Summary ---- */}
      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Order summary</h2>
          <ul className="space-y-3 text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="text-fg-2">
                  {l.name}
                  <span className="block text-xs text-muted">
                    {l.variantLabel} × {l.quantity}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2 border-t border-line pt-4">
            <input
              placeholder="Discount code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${field} py-2 text-sm`}
            />
            <button
              type="button"
              onClick={() => setAppliedCode(code.trim())}
              className="rounded-lg border border-line-2 px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
            >
              Apply
            </button>
          </div>
          {quote?.discountError && (
            <p className="mt-2 text-xs text-warn">{quote.discountError}</p>
          )}

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-fg-2">{quote ? cents(quote.subtotalCents) : "—"}</dd>
            </div>
            {quote && quote.discountCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="text-success">−{cents(quote.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-fg-2">
                {quote ? (quote.shippingCents === 0 ? "Free" : cents(quote.shippingCents)) : "—"}
              </dd>
            </div>
            {quote?.giftApplied && (
              <div className="flex justify-between">
                <dt className="text-muted">Free bacteriostatic water</dt>
                <dd className="text-success">Included</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base">
              <dt className="font-semibold text-fg">Total</dt>
              <dd className="font-semibold text-fg">{quote ? cents(quote.totalCents) : "—"}</dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={pending || !quote}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>

          {error && <p className="mt-3 text-sm text-warn">{error}</p>}
          {quote?.warnings?.map((w) => (
            <p key={w} className="mt-2 text-xs text-warn">
              {w}
            </p>
          ))}
        </div>

        <p className="px-1 text-xs text-muted-2">
          Every batch is independently tested with the COA published before it ships.
          Research use only.
        </p>
      </aside>
    </form>
  );
}
