"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Plus } from "lucide-react";
import Badge from "./Badge";
import { setReviewStatus, createReview } from "@/app/admin/(dashboard)/reviews/actions";

export interface ReviewRow {
  id: string;
  product_slug: string;
  author: string;
  location: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: string;
  is_sample: boolean;
  created_at: string;
}

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

export default function ReviewModeration({
  reviews,
  productSlugs,
}: {
  reviews: ReviewRow[];
  productSlugs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    productSlug: productSlugs[0]?.slug ?? "",
    author: "",
    location: "",
    rating: 5,
    title: "",
    body: "",
    verified: true,
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  const pendingReviews = reviews.filter((r) => r.status === "pending");
  const others = reviews.filter((r) => r.status !== "pending");

  const Card = ({ r }: { r: ReviewRow }) => (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-warn">{"★".repeat(r.rating)}<span className="text-line-2">{"★".repeat(5 - r.rating)}</span></span>
        <span className="font-medium text-fg">{r.title}</span>
        <Badge tone={r.status === "published" ? "success" : r.status === "rejected" ? "danger" : "warn"}>
          {r.status}
        </Badge>
        {r.verified && <Badge tone="info">verified buyer</Badge>}
        {r.is_sample && <Badge tone="neutral">sample</Badge>}
      </div>
      <p className="text-sm text-fg-2">{r.body}</p>
      <p className="text-xs text-muted">
        {r.author}
        {r.location ? ` · ${r.location}` : ""} · {r.product_slug} ·{" "}
        {new Date(r.created_at).toLocaleDateString("en-AU")}
      </p>
      <div className="flex gap-2 pt-1">
        {r.status !== "published" && (
          <button
            disabled={pending}
            onClick={() => run(() => setReviewStatus(r.id, "published"))}
            className={`${btn} flex items-center gap-1.5 bg-accent text-accent-ink hover:brightness-95`}
          >
            <Check size={14} /> Publish
          </button>
        )}
        {r.status !== "rejected" && (
          <button
            disabled={pending}
            onClick={() => run(() => setReviewStatus(r.id, "rejected"))}
            className={`${btn} flex items-center gap-1.5 border border-line-2 text-muted hover:text-fg`}
          >
            <X size={14} /> Reject
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {pendingReviews.length} awaiting moderation · {reviews.filter((r) => r.status === "published").length}{" "}
          published
        </p>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={`${btn} flex items-center gap-1.5 border border-line-2 bg-surface text-fg-2 hover:text-fg`}
        >
          <Plus size={15} /> Add a review
        </button>
      </div>

      {showAdd && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Add a review</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.productSlug}
              onChange={(e) => setForm({ ...form, productSlug: e.target.value })}
              className={field}
            >
              {productSlugs.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              className={field}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <input
              placeholder="Author name"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className={field}
            />
            <input
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={field}
            />
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
            <textarea
              rows={3}
              placeholder="Review body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className={`${field} sm:col-span-2`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              className="accent-accent"
            />
            Verified buyer
          </label>
          <button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await createReview(form);
                if (res.ok) {
                  setForm({ ...form, author: "", location: "", title: "", body: "" });
                  setShowAdd(false);
                }
                return res;
              })
            }
            className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
          >
            Save & publish
          </button>
        </section>
      )}

      {pendingReviews.length > 0 && (
        <section className="rounded-xl border border-warn/30 bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-warn">Awaiting moderation</h3>
          </div>
          <div className="divide-y divide-line">
            {pendingReviews.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">All reviews</h3>
        </div>
        {others.length === 0 && pendingReviews.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-fg">No reviews yet.</p>
            <p className="mt-1 text-sm text-muted">
              Sample review data has been retired — the storefront shows ratings only once you
              publish real ones here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {others.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
