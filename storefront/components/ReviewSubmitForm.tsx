"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { lookupOrder, submitReview, type OrderProduct } from "@/app/(store)/leave-a-review/actions";

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-fg outline-none transition focus:border-accent";

interface Props {
  initialOrder?: string;
  initialEmail?: string;
  /** Pre-selected star from a review-request email's deep link (0 = none). */
  initialRating?: number;
}

export default function ReviewSubmitForm({
  initialOrder = "",
  initialEmail = "",
  initialRating = 0,
}: Props) {
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [email, setEmail] = useState(initialEmail);
  const [products, setProducts] = useState<OrderProduct[] | null>(null);
  const [productSlug, setProductSlug] = useState("");
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(initialRating);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const verify = () =>
    startTransition(async () => {
      setError(null);
      const res = await lookupOrder(orderNumber, email);
      if (!res.ok || !res.products) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setProducts(res.products);
      setProductSlug(res.products[0]?.slug ?? "");
    });

  // Arriving from a review-request email already carries proof of purchase in
  // the link, so re-asking the customer to press "Find my order" is a step that
  // only loses people. Verify once on mount when both fields came prefilled.
  const autoVerified = useRef(false);
  useEffect(() => {
    if (autoVerified.current) return;
    if (!initialOrder || !initialEmail) return;
    autoVerified.current = true;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await submitReview({ orderNumber, email, productSlug, author, rating, title, body });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
    });

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-semibold text-fg">Thanks — review received</p>
        <p className="mt-2 text-sm text-muted">
          Your review is with our team for moderation. We publish honest feedback regardless of rating —
          we just screen for spam.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="space-y-4">
        <div>
          <label htmlFor="review-order" className="mb-1 block text-sm font-medium text-fg">
            Order number
          </label>
          <input
            id="review-order"
            className={field}
            placeholder="ECL-1024"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            disabled={products !== null}
          />
        </div>
        <div>
          <label htmlFor="review-email" className="mb-1 block text-sm font-medium text-fg">
            Email you ordered with
          </label>
          <input
            id="review-email"
            type="email"
            className={field}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={products !== null}
          />
        </div>

        {products === null ? (
          <button
            type="button"
            onClick={verify}
            disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Checking…" : "Find my order"}
          </button>
        ) : (
          <>
            <div>
              <span className="mb-1 block text-sm font-medium text-fg">Which product are you reviewing?</span>
              <div className="space-y-2">
                {products.map((p) => (
                  <label
                    key={p.slug}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                      productSlug === p.slug ? "border-accent bg-accent/10 text-fg" : "border-line text-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="product"
                      className="accent-current"
                      checked={productSlug === p.slug}
                      onChange={() => setProductSlug(p.slug)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-fg">Rating</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    onClick={() => setRating(n)}
                    className={`grid h-10 w-10 place-items-center rounded-lg border text-lg transition ${
                      rating >= n ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="review-author" className="mb-1 block text-sm font-medium text-fg">
                Display name
              </label>
              <input
                id="review-author"
                className={field}
                placeholder="First name or initials"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="review-title" className="mb-1 block text-sm font-medium text-fg">
                Title
              </label>
              <input
                id="review-title"
                className={field}
                placeholder="Sum it up in a line"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="review-body" className="mb-1 block text-sm font-medium text-fg">
                Your review
              </label>
              <textarea
                id="review-body"
                rows={5}
                className={field}
                placeholder="Dispatch speed, packaging, COA verification — honest feedback only."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={pending || rating === 0}
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit review"}
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
