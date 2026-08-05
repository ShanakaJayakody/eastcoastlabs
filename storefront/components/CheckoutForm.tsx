"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatAud } from "@/lib/format";
import {
  placeOrder,
  quoteCart,
  captureCartEmail,
  type CheckoutAddress,
  type CartQuote,
} from "@/app/(store)/checkout/actions";
import type { PaymentMethod } from "@/lib/payments";
import type { ShippingMethod } from "@/lib/shipping";
import CheckoutBump, { type BumpProduct } from "./CheckoutBump";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const cents = (c: number) => formatAud(c / 100);

export default function CheckoutForm({ bumps = [] }: { bumps?: BumpProduct[] }) {
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
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
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
    quoteCart(payload, appliedCode || undefined, shippingMethod)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        // Default to the first offered method, but never override a choice the
        // shopper has already made.
        setPaymentMethod((current) =>
          current && q.paymentOptions.some((o) => o.method === current)
            ? current
            : q.paymentOptions[0]?.method ?? null,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lines, ready, appliedCode, shippingMethod]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await placeOrder({
        email,
        name,
        address,
        discountCode: appliedCode || undefined,
        paymentMethod: paymentMethod ?? undefined,
        shippingMethod,
        deliveryInstructions: deliveryInstructions || undefined,
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
            <div className="sm:col-span-2">
              <textarea
                placeholder="Delivery instructions (optional) — e.g. leave behind the pot plant"
                value={deliveryInstructions}
                maxLength={500}
                rows={2}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className={`${field} resize-none`}
              />
              <p className="mt-1 text-[11px] text-muted-2">
                Passed to the courier and our packers. Not printed on the label.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Order bump: the accessory every peptide order needs ---- */}
        {bumps.length > 0 && <CheckoutBump products={bumps} />}

        {/* ---- Shipping method ---- */}
        {quote && quote.shippingOptions.length > 1 && (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-fg">Shipping method</h2>
            <div className="grid gap-2.5">
              {quote.shippingOptions.map((opt) => {
                const isSel = opt.method === shippingMethod;
                return (
                  <label
                    key={opt.method}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                      isSel ? "border-accent bg-accent/5" : "border-line bg-ink-2 hover:border-line-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={isSel}
                      onChange={() => setShippingMethod(opt.method)}
                      className="sr-only"
                    />
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                        isSel ? "border-accent" : "border-line-2"
                      }`}
                    >
                      {isSel && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{opt.label}</span>
                      <span className="block text-xs text-muted">
                        {opt.eta}
                        {!opt.isFree && opt.remainingCents > 0 && (
                          <>
                            {" · "}
                            <span className="text-accent">
                              {cents(opt.remainingCents)} more for free
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {opt.isFree ? (
                        <>
                          <span className="text-sm font-bold text-success">Free</span>
                          <span className="ml-1.5 text-xs text-muted-2 line-through">
                            {cents(opt.baseCents)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-fg">{cents(opt.cents)}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* ---- Payment method ---- */}
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold text-fg">Payment</h2>
          <p className="mb-3 text-xs text-muted">
            Nothing is charged on this page. You&apos;ll get the transfer details — with a reference
            and the exact amount — the moment you place the order.
          </p>

          {quote && quote.paymentOptions.length === 0 ? (
            <p className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
              Payments are temporarily unavailable. Please contact support before ordering.
            </p>
          ) : (
            <div className="grid gap-2.5">
              {(quote?.paymentOptions ?? []).map((opt) => {
                const isSel = opt.method === paymentMethod;
                return (
                  <label
                    key={opt.method}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                      isSel ? "border-accent bg-accent/5" : "border-line bg-ink-2 hover:border-line-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={isSel}
                      onChange={() => setPaymentMethod(opt.method)}
                      className="sr-only"
                    />
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                        isSel ? "border-accent" : "border-line-2"
                      }`}
                    >
                      {isSel && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-fg">{opt.label}</span>
                        {opt.badges.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success"
                          >
                            {b}
                          </span>
                        ))}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        {opt.blurb}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
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
            {/* GST is included in every displayed price — say so, so nobody
                expects a surprise line at the end. */}
            {quote && quote.totalCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-2 text-xs">Includes GST</dt>
                <dd className="text-muted-2 text-xs">{cents(Math.round(quote.totalCents / 11))}</dd>
              </div>
            )}
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
            disabled={pending || !quote || !paymentMethod}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-2">
            No card details needed. You&apos;ll get transfer details next.
          </p>

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
