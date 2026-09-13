import type { TierCard } from './pricing';

export interface ProductSizeImage {
  src: string;
  alt?: string;
}

/** A purchasable size, with its own stable SKU identity and stock pool. */
export interface ProductSizeOption {
  id: number;
  slug: string;
  sku?: string;
  label: string;
  priceMinor: string;
  available: number;
  tiers: TierCard[] | null;
  images?: ProductSizeImage[];
  shortDescription?: string;
  description?: string;
}

/** Keep legacy bare peptide masses explicit at every customer-facing surface. */
export function normalizeProductSizeLabel(label: string): string {
  const compact = label.trim().replace(/\s+/g, ' ');
  if (/^\d+(?:\.\d+)?$/.test(compact)) return `${compact} mg`;
  return compact.replace(/^(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)$/i, (_, amount, unit) => `${amount} ${String(unit).toLowerCase()}`);
}

/** Lowest single-vial price a shopper can actually select right now. */
export function purchasableStartingPriceMinor(
  sizes: readonly Pick<ProductSizeOption, 'priceMinor' | 'available'>[] | undefined,
  fallbackMinor: string,
): number {
  const valid = (sizes ?? []).filter((size) => Number.isSafeInteger(Number(size.priceMinor)) && Number(size.priceMinor) >= 0);
  const available = valid.filter((size) => size.available > 0);
  const candidates = available.length ? available : valid;
  const rawFallback = Number(fallbackMinor);
  const fallback = Number.isSafeInteger(rawFallback) && rawFallback >= 0 ? rawFallback : 0;
  return candidates.length ? Math.min(...candidates.map((size) => Number(size.priceMinor))) : fallback;
}

/** Join only display rows; inventory/reporting callers keep the original rows. */
export function groupProductSizes<T extends {
  id: string; size_parent_id?: string | null; size_label?: string | null;
  totalOnHand: number; lowStock: boolean; minPriceCents: number; variants: unknown[];
}>(rows: T[]): (T & { sizeOptions?: T[] })[] {
  return rows.filter(row => !row.size_parent_id).map(parent => {
    const children = rows.filter(row => row.size_parent_id === parent.id);
    if (!children.length) return parent;
    const sizes = [parent, ...children];
    return { ...parent, sizeOptions: sizes,
      totalOnHand: sizes.reduce((sum, size) => sum + size.totalOnHand, 0),
      lowStock: sizes.some(size => size.lowStock),
      minPriceCents: Math.min(...sizes.map(size => size.minPriceCents)),
      variants: sizes.flatMap(size => size.variants) as T['variants'],
    };
  });
}
