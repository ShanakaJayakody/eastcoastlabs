"use client";

import CartRecoveryRequest from "./CartRecoveryRequest";
import {normalizeCheckoutLines} from "@/lib/checkout-lines";
import { CHECKOUT_FIELDS, type CheckoutField, type CheckoutFieldErrors } from "@/lib/checkout-fields";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { trackOrderCreated } from "@/lib/analytics";
import { formatAud } from "@/lib/format";
import {
  placeOrder,
  recoverCheckoutAttempt,
  type PlaceOrderResult,
  quoteCart,
  type CheckoutAddress,
  type CartQuote,
} from "@/app/(store)/checkout/actions";
import {readCheckoutAttempt,saveCheckoutAttempt,clearCheckoutAttempt,checkoutRequestHash,type StoredCheckoutAttempt} from "@/lib/checkout-attempt";
import type { PaymentMethod } from "@/lib/payments";
import type { ShippingMethod } from "@/lib/shipping";
import CheckoutBump, { type BumpProduct } from "./CheckoutBump";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const cents = (c: number) => formatAud(c / 100);

export default function CheckoutForm({ bumps = [] }: { bumps?: BumpProduct[] }) {
  const { lines, ready, completeOrder } = useCart();

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
  const [fieldErrors,setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [quotedKey, setQuotedKey] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const attempt = useRef<{key:string;id:string;unconfirmed?:boolean} | null>(null);
  const automaticShippingChange = useRef(false);
  const [previousAttempt,setPreviousAttempt] = useState<StoredCheckoutAttempt|null>(null);
  useEffect(()=>{setPreviousAttempt(readCheckoutAttempt());},[]);
  const payload = normalizeCheckoutLines(lines);
  const requestKey = JSON.stringify([payload, appliedCode, shippingMethod]);
  const quoteReady = !!quote && quotedKey === requestKey && !quoteError;
  useEffect(() => {
    if (!error || pending) return;
    const first = CHECKOUT_FIELDS.find(field => fieldErrors[field]);
    const control = first ? document.getElementById(`checkout-${first}`) : null;
    if (control) control.focus(); else errorRef.current?.focus();
  }, [error,fieldErrors,pending]);
  const invalid = (name:CheckoutField) => ({name,id:`checkout-${name}`,"aria-invalid":!!fieldErrors[name],"aria-describedby":fieldErrors[name] ? `checkout-${name}-error`:undefined});
  const fieldError = (name:CheckoutField) => fieldErrors[name] ? <span id={`checkout-${name}-error`} className="mt-1 block text-xs text-warn">{fieldErrors[name]}</span> : null;

  useEffect(() => {
    if (!ready || lines.length === 0) return;
    let cancelled = false;
    setQuotedKey("");
    setQuoteError(null);
    quoteCart(payload, appliedCode || undefined, shippingMethod)
      .then(q => {
        if (cancelled) return;
        setQuote(q);
        setQuotedKey(requestKey);
        // A disabled service may have been replaced by the authoritative quote.
        // Changing the request key keeps submission blocked until it is repriced.
        if(q.shippingMethod!==shippingMethod)automaticShippingChange.current=true;
        setShippingMethod(q.shippingMethod);
        setPaymentMethod(current => current && q.paymentOptions.some(o => o.method === current)
          ? current : q.paymentOptions[0]?.method ?? null);
      }).catch(() => {
        if (!cancelled) setQuoteError("We couldn’t confirm your order total. Please retry.");
      });
    return () => { cancelled = true; };
    // requestKey contains every price-relevant input; payload is reconstructed per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, ready, retry]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteReady || pending || !paymentMethod) return;
    setError(null);setFieldErrors({});
    // Match the server request fingerprint. A newer quote is still the same
    // customer request, including after a committed order loses its response.
    const attemptKey = JSON.stringify({
      email: email.trim().toLowerCase(), name: name.trim(),
      shippingAddress: {
        line1: address.line1.trim(), line2: address.line2?.trim() || null,
        suburb: address.suburb.trim(), state: address.state.trim().toUpperCase(),
        postcode: address.postcode.trim(), country: "AU", phone: address.phone?.trim() || null,
        shipping_method: shippingMethod, delivery_instructions: deliveryInstructions.trim() || null,
      },
      lines: payload, paymentMethod, discountCode: appliedCode.trim().toUpperCase() || undefined,
    });
    // An automatic service fallback must not authorise a second order while
    // the original request may still commit. Explicit customer edits stay distinct.
    if(automaticShippingChange.current && attempt.current?.unconfirmed && attempt.current.key!==attemptKey){
      const previous=JSON.parse(attempt.current.key);
      previous.shippingAddress.shipping_method=shippingMethod;
      if(!quote!.paymentOptions.some(o=>o.method===previous.paymentMethod))previous.paymentMethod=paymentMethod;
      if(JSON.stringify(previous)===attemptKey){
        setError("Shipping changed after an unconfirmed order attempt. Check your previous order attempt before placing another order.");
        return;
      }
    }
    startTransition(async () => {
      try {
        const hash = await checkoutRequestHash(attemptKey);
        const stored = hash ? readCheckoutAttempt() : null;
        if (!attempt.current || attempt.current.key !== attemptKey) {
          attempt.current = {key:attemptKey,id:stored?.hash===hash ? stored.id : crypto.randomUUID(),unconfirmed:stored?.hash===hash};
        }
        const submittedAttempt=attempt.current;
        const wasUnconfirmed=!!submittedAttempt.unconfirmed;
        submittedAttempt.unconfirmed=true;
        const idempotencyKey = attempt.current.id;
        if(hash){const saved={id:idempotencyKey,hash};saveCheckoutAttempt(saved);setPreviousAttempt(saved);}
        const res = await placeOrder({email,name,address,discountCode:appliedCode || undefined,
          paymentMethod,shippingMethod,deliveryInstructions:deliveryInstructions || undefined,
          lines:payload,idempotencyKey,quoteVersion:quote!.version});
        if (!res.ok) {
          if (res.quote) {
            // This response declined the current request, but cannot rule out a
            // still-running earlier request whose response was lost.
            if(!wasUnconfirmed)submittedAttempt.unconfirmed=false;
            const q=res.quote;
            setQuote(q);setQuotedKey(requestKey);
            if(q.shippingMethod!==shippingMethod)automaticShippingChange.current=true;
            setShippingMethod(q.shippingMethod);
            setPaymentMethod(current => current && q.paymentOptions.some(o => o.method === current)
              ? current : q.paymentOptions[0]?.method ?? null);
          }
          setFieldErrors(res.fieldErrors ?? {});setError(res.error);
          return;
        }
        finishOrder(res);
      } catch {
        setError("We couldn’t confirm whether your order was created. Retry to safely check the same order attempt.");
      }
    });
  }

  function finishOrder(res:Extract<PlaceOrderResult,{ok:true}>) {
    if(res.purchasedLines){
      if(!res.replayed) trackOrderCreated(res.orderNumber,res.purchasedLines.map(l=>({item_id:l.slug,item_name:l.name,item_variant:l.variantLabel,price:l.unitPriceCents/100,quantity:l.quantity})),res.totalCents/100);
      completeOrder(res.purchasedLines);
    }
    attempt.current=null;clearCheckoutAttempt();setPreviousAttempt(null);
    globalThis.location.assign(res.paymentUrl);
  }
  function recoverPrevious() {
    if(!previousAttempt || pending)return;
    const saved=previousAttempt;setError(null);setFieldErrors({});
    startTransition(async()=>{
      try {
        const res=await recoverCheckoutAttempt(saved.id,saved.hash);
        if(res.ok){finishOrder(res);return;}
        // A concurrent original request may still commit after this read.
        // Retain the private identity and recovery control for another check.
        setError(res.error);
      } catch {setError("We couldn’t check your previous order. Please retry this check.");}
    });
  }
  const recoveryButton=previousAttempt && <button type="button" disabled={pending} onClick={recoverPrevious} className="mt-3 w-full rounded-lg border border-accent px-4 py-3 text-sm text-accent disabled:opacity-60">Check previous order attempt</button>;

  if (ready && lines.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-fg">Your cart is empty.</p>
        {recoveryButton}
        {error && <p role="alert" className="mt-3 text-warn">{error}</p>}
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
    "min-w-0 w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-fg outline-none transition focus:border-accent";

  return (
    <form onSubmit={submit} className="mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <fieldset disabled={pending} className="contents">
      <legend className="sr-only">Checkout details</legend>
      {/* ---- Details ---- */}
      <div className="min-w-0 space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="checkout-email" className="min-w-0 block text-xs text-fg-2 sm:col-span-2">Email address<span className="mt-1 block"><input {...invalid("email")}
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${field} `}
            /></span></label>{fieldError("email")}
            <div className="sm:col-span-2"><CartRecoveryRequest email={email} lines={payload}/></div>
            <label htmlFor="checkout-name" className="min-w-0 block text-xs text-fg-2 sm:col-span-2">Full name<span className="mt-1 block"><input {...invalid("name")}
              required
              placeholder="Full name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${field} `}
            /></span></label>{fieldError("name")}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Shipping address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="checkout-street" className="min-w-0 block text-xs text-fg-2 sm:col-span-2">Street address<span className="mt-1 block"><input {...invalid("street")}
              required
              placeholder="Street address"
              autoComplete="address-line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className={`${field} `}
            /></span></label>{fieldError("street")}
            <label htmlFor="checkout-unit" className="min-w-0 block text-xs text-fg-2 sm:col-span-2">Apartment, unit (optional)<span className="mt-1 block"><input {...invalid("unit")}
              placeholder="Apartment, unit (optional)"
              autoComplete="address-line2"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              className={`${field} `}
            /></span></label>{fieldError("unit")}
            <label htmlFor="checkout-suburb" className="min-w-0 block text-xs text-fg-2 ">Suburb<span className="mt-1 block"><input {...invalid("suburb")}
              required
              placeholder="Suburb"
              autoComplete="address-level2"
              value={address.suburb}
              onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
              className={field}
            /></span></label>{fieldError("suburb")}
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <label className="min-w-0 block text-xs text-fg-2">State<select {...invalid("state")}
                autoComplete="address-level1"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className={field}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select></label>{fieldError("state")}
              <label htmlFor="checkout-postcode" className="min-w-0 block text-xs text-fg-2 ">Postcode<span className="mt-1 block"><input {...invalid("postcode")}
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
              /></span></label>{fieldError("postcode")}
            </div>
            <label htmlFor="checkout-phone" className="min-w-0 block text-xs text-fg-2 sm:col-span-2">Phone (optional)<span className="mt-1 block"><input type="tel" {...invalid("phone")}
              placeholder="Phone (optional)"
              autoComplete="tel"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              className={`${field} `}
            /></span></label>{fieldError("phone")}
            <div className="sm:col-span-2">
              <label className="block text-xs text-fg-2">Delivery instructions (optional)<textarea {...invalid("instructions")}
                placeholder="Delivery instructions (optional) — e.g. leave behind the pot plant"
                value={deliveryInstructions}
                maxLength={500}
                rows={2}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className={`${field} resize-none`}
              /></label>{fieldError("instructions")}
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
            <h2 className="mb-3 text-sm font-semibold text-fg">Shipping method</h2>{fieldError("shipping")}
            <div id="checkout-shipping" tabIndex={-1} aria-invalid={!!fieldErrors.shipping} aria-describedby={fieldErrors.shipping?"checkout-shipping-error":undefined} role="radiogroup" aria-label="Shipping method" className="grid gap-2.5">
              {quote.shippingOptions.map((opt) => {
                const isSel = opt.method === shippingMethod;
                return (
                  <label
                    key={opt.method}
                    className={`focus-within:ring-2 focus-within:ring-accent flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                      isSel ? "border-accent bg-accent/5" : "border-line bg-ink-2 hover:border-line-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={isSel}
                      onChange={() => {automaticShippingChange.current=false;setShippingMethod(opt.method);}}
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
          <h2 className="mb-1 text-sm font-semibold text-fg">Payment</h2>{fieldError("payment")}
          <p className="mb-3 text-xs text-muted">
            Nothing is charged on this page. You&apos;ll get the transfer details — with a reference
            and the exact amount — the moment you place the order.
          </p>

          {quote && quote.paymentOptions.length === 0 ? (
            <p className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
              Payments are temporarily unavailable. Please contact support before ordering.
            </p>
          ) : (
            <div id="checkout-payment" tabIndex={-1} aria-invalid={!!fieldErrors.payment} aria-describedby={fieldErrors.payment?"checkout-payment-error":undefined} role="radiogroup" aria-label="Payment method" className="grid gap-2.5">
              {(quote?.paymentOptions ?? []).map((opt) => {
                const isSel = opt.method === paymentMethod;
                return (
                  <label
                    key={opt.method}
                    className={`focus-within:ring-2 focus-within:ring-accent flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
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
      <aside className="min-w-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-fg">Order summary</h2>
          {recoveryButton}
          <button type="button" disabled={pending} onClick={() => setRetry(v => v+1)} className="mb-3 text-xs text-accent underline">Refresh order total</button>
          <ul className="space-y-3 text-sm">
            {(quote?.lines ?? []).map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="text-fg-2">
                  {l.name}
                  <span className="block text-xs text-muted">
                    {l.variantLabel} × {l.quantity}
                  </span>
                </span>
                <span>{cents(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2 border-t border-line pt-4">
            <label htmlFor="checkout-discount" className="min-w-0 block text-xs text-fg-2 ">Discount code<span className="mt-1 block"><input {...invalid("discount")} aria-invalid={!!fieldErrors.discount || !!quote?.discountError} aria-describedby={fieldErrors.discount ? "checkout-discount-error" : quote?.discountError ? "discount-error" : undefined}
              placeholder="Discount code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${field} py-2 text-sm`}
            /></span></label>
            <button
              type="button"
              onClick={() => setAppliedCode(code.trim())}
              className="rounded-lg border border-line-2 px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
            >
              Apply
            </button>
          </div>
          {fieldError("discount")}
          {quote?.discountError && (
            <p id="discount-error" role="alert" className="mt-2 text-xs text-warn">{quote.discountError}</p>
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
            disabled={pending || !quoteReady || !paymentMethod || !!quote?.discountError || !quote?.lines.some(l => !l.isGift)}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-2">
            No card details needed. You&apos;ll get transfer details next.
          </p>

          {!quoteReady && !quoteError && <p role="status" className="mt-3 text-sm text-muted">Updating your order total…</p>}
          {quoteError && <div role="alert" className="mt-3 text-sm text-warn">{quoteError}<button type="button" className="ml-2 underline" onClick={() => setRetry(v => v+1)}>Retry total</button></div>}
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          {quote?.warnings?.map((w) => (
            <p key={w} className="mt-2 text-xs text-warn">
              {w}
            </p>
          ))}
        </div>

        <p className="px-1 text-xs text-muted-2">
          Research use only. Check available batch documentation before ordering.
        </p>
      </aside>
      </fieldset>
    </form>
  );
}
