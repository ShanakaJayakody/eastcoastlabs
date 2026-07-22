/**
 * Reviews data layer.
 *
 * Source: data/reviews.json — currently SAMPLE data (sample=true) for layout
 * and development. The UI surfaces a visible "Sample data" marker whenever
 * `isSample()` is true, so nothing is presented to shoppers as genuine until
 * real reviews are supplied. When real reviews land, set sample=false and swap
 * the content (or point this loader at a live reviews feed) — no component
 * changes needed.
 */

import reviewsData from "@/data/reviews.json";

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

interface ReviewsFile {
  sample: boolean;
  verifiedLabel: string;
  products: Record<string, { rating: number; count: number; reviews?: Review[] }>;
}

const DATA = reviewsData as unknown as ReviewsFile;

/** True while the loaded reviews are placeholder/sample data. */
export function isSample(): boolean {
  return DATA.sample === true;
}

export function verifiedLabel(): string {
  return DATA.verifiedLabel || "Verified buyer";
}

/** Aggregate + detailed reviews for a product slug (null when none exist). */
export function getProductReviews(slug: string): ProductReviews | null {
  const entry = DATA.products[slug];
  if (!entry) return null;
  return {
    rating: entry.rating,
    count: entry.count,
    reviews: (entry.reviews ?? []).slice(),
  };
}

/** Just the aggregate (rating + count) — for cards and the buy box. */
export function getAggregate(slug: string): { rating: number; count: number } | null {
  const entry = DATA.products[slug];
  if (!entry || !entry.count) return null;
  return { rating: entry.rating, count: entry.count };
}

/**
 * Site-wide aggregate rating (average weighted by review count). Used for the
 * homepage trust chip. Returns null when there is no data.
 */
export function getSiteAggregate(): { rating: number; count: number } | null {
  const entries = Object.values(DATA.products).filter((p) => p.count > 0);
  if (entries.length === 0) return null;
  const totalCount = entries.reduce((s, p) => s + p.count, 0);
  const weighted = entries.reduce((s, p) => s + p.rating * p.count, 0);
  return { rating: Math.round((weighted / totalCount) * 10) / 10, count: totalCount };
}
