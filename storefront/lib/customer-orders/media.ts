interface ProductMedia {
  size_parent_id?: string | null;
  size_label?: string | null;
  images?: {src?:string;size_label?:string|null}[] | null;
}
const sizeKey = (value: string | null | undefined) => (value ?? '').replace(/\s/g, '').toLowerCase();
/** Size rows inherit their parent's gallery. Only an explicitly size-tagged image
 * can identify a child size; the row's own size label is not image provenance. */
export function historicalProductImage(product: ProductMedia, snapshotSize: string | null | undefined, variantLabel: string | null | undefined): string | null {
  const recorded = snapshotSize || variantLabel?.split('·').map(v=>v.trim()).find(v=>sizeKey(v)===sizeKey(product.size_label));
  if (product.size_label && (!recorded || sizeKey(recorded)!==sizeKey(product.size_label))) return null;
  const images = Array.isArray(product.images) ? product.images : [];
  const exact = product.size_label ? images.find(i=>i.size_label && sizeKey(i.size_label)===sizeKey(product.size_label)) : undefined;
  if (exact) return exact.src || null;
  const first = images[0];
  return !product.size_parent_id && !first?.size_label ? first?.src || null : null;
}
