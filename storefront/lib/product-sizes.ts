import type { TierCard } from './pricing';

/** A purchasable size, with its own stable SKU identity and stock pool. */
export interface ProductSizeOption {
  id: number;
  slug: string;
  label: string;
  priceMinor: string;
  available: number;
  tiers: TierCard[] | null;
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
