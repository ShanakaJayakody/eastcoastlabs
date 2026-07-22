/**
 * Collections — group products by research goal. Drives /collections/[slug]
 * pages and the shop filter pills. Client-safe (bundled JSON).
 */

import collectionsData from "@/data/collections.json";

export interface Collection {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  products: string[]; // product slugs
}

const COLLECTIONS = (collectionsData as unknown as { collections: Collection[] }).collections;

export function getCollections(): Collection[] {
  return COLLECTIONS.slice();
}

export function getCollection(slug: string): Collection | null {
  return COLLECTIONS.find((c) => c.slug === slug) ?? null;
}

/** Collections a given product belongs to (for tags on cards/PDP). */
export function getCollectionsForProduct(productSlug: string): Collection[] {
  return COLLECTIONS.filter((c) => c.products.includes(productSlug));
}
