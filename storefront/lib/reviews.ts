import "server-only";

/**
 * Reviews data layer — SUPABASE-BACKED (sample JSON retired).
 *
 * Only rows with status='published' are ever returned, so the moderation queue at
 * /admin/reviews is the single gate between a submitted review and a shopper
 * seeing it. When a product has no published reviews we return null and the UI
 * omits ratings entirely — we never synthesise social proof.
 *
 * Server-only: every consumer (PDP, product cards, home) is a server component.
 */
import { supabaseAdmin } from "./supabase";

export interface Review {
  author: string;
  location?: string;
  rating: number;
  date: string; // ISO yyyy-mm-dd
  verified: boolean;
  title: string;
  body: string;
}

export interface ProductReviews {
  rating: number; // aggregate 0..5
  count: number;
  reviews: Review[];
}

interface Row {
  product_slug: string;
  author: string;
  location: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  created_at: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Retired: the storefront no longer renders placeholder reviews, so nothing needs
 * a "sample data" badge. Kept as a stable export for components that render it
 * conditionally.
 */
export function isSample(): boolean {
  return false;
}

export function verifiedLabel(): string {
  return "Verified buyer";
}

async function fetchPublished(slug?: string): Promise<Row[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  let q = db
    .from("reviews")
    .select("product_slug, author, location, rating, title, body, verified, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (slug) q = q.eq("product_slug", slug);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as Row[];
}

/** Aggregate + detailed reviews for a product slug (null when none exist). */
export async function getProductReviews(slug: string): Promise<ProductReviews | null> {
  const rows = await fetchPublished(slug);
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + r.rating, 0);
  return {
    rating: round1(sum / rows.length),
    count: rows.length,
    reviews: rows.map((r) => ({
      author: r.author,
      location: r.location ?? undefined,
      rating: r.rating,
      date: r.created_at.slice(0, 10),
      verified: r.verified,
      title: r.title,
      body: r.body,
    })),
  };
}

/** Just the aggregate (rating + count) — for cards and the buy box. */
export async function getAggregate(slug: string): Promise<{ rating: number; count: number } | null> {
  const rows = await fetchPublished(slug);
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + r.rating, 0);
  return { rating: round1(sum / rows.length), count: rows.length };
}

/** Site-wide aggregate across every published review — homepage trust chip. */
export async function getSiteAggregate(): Promise<{ rating: number; count: number } | null> {
  const rows = await fetchPublished();
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + r.rating, 0);
  return { rating: round1(sum / rows.length), count: rows.length };
}

/** Batched aggregates for a list of slugs — used by decorateCards(). */
export async function getAggregates(
  slugs: string[],
): Promise<Record<string, { rating: number; count: number }>> {
  if (!slugs.length) return {};
  const rows = await fetchPublished();
  const out: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (!slugs.includes(r.product_slug)) continue;
    out[r.product_slug] ??= { sum: 0, n: 0 };
    out[r.product_slug].sum += r.rating;
    out[r.product_slug].n += 1;
  }
  return Object.fromEntries(
    Object.entries(out).map(([slug, v]) => [slug, { rating: round1(v.sum / v.n), count: v.n }]),
  );
}
