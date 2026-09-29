const STRENGTH = /^\d+(?:\.\d+)?\s*(?:mcg|ug|µg|mg|g|kg|ml|l|iu|units?)$/i;

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Separate an ordered strength from pack/SKU detail so operators cannot miss it. */
export function orderItemVariantIdentity(
  variantLabel: string | null | undefined,
  currentSizeLabel?: string | null,
): { sizeLabel: string | null; detailLabel: string | null } {
  const parts = (variantLabel ?? "")
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  // Prefer the order-time snapshot when it contains a strength. The linked
  // product size is a fallback for older orders whose saved label was only
  // "3-pack".
  const linkedSize = clean(currentSizeLabel);
  // Sized variants are serialized as "pack · size". Use that structural
  // snapshot before consulting today's catalogue label so later renames cannot
  // change what the packing screen says the customer ordered.
  const snapshotIndex = linkedSize && parts.length > 1
    ? 1
    : parts.findIndex((part) => STRENGTH.test(part));
  const snapshotSize = snapshotIndex >= 0 ? parts[snapshotIndex] : null;
  const sizeLabel = snapshotSize ?? linkedSize;
  const detail = snapshotIndex >= 0
    ? parts.filter((_, index) => index !== snapshotIndex)
    : parts;
  return { sizeLabel, detailLabel: detail.join(" · ") || null };
}
