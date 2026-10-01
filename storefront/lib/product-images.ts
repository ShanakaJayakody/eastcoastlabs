export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

/** Shared validation for the file picker and authoritative storage metadata. */
export function productImageError(file: { size?: number; type?: string } | null | undefined): string | null {
  if (!file || !Number.isSafeInteger(file.size) || (file.size ?? 0) <= 0) return "Choose an image file.";
  if (typeof file.type !== "string" || !file.type.startsWith("image/")) return "File must be an image.";
  if (file.size! > MAX_PRODUCT_IMAGE_BYTES) return "Image must be 8MB or smaller.";
  return null;
}
