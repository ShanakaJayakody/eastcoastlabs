/**
 * Custom next/image loader.
 *
 * Vercel's built-in optimizer (`/_next/image`) is quota-limited per plan and,
 * once exhausted, returns 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED for every
 * size that isn't already in the edge cache — which is how the admin product
 * thumbnails (new 48/96px variants) broke while the storefront kept serving
 * stale cached copies.
 *
 * Product images live in the public `product-images` Supabase Storage bucket,
 * and Supabase exposes its own resize endpoint for that bucket. This loader
 * routes those URLs through Supabase's transformer instead of Vercel's, so
 * thumbnails are small AND independent of the Vercel image quota. Anything
 * else (local /public assets, other remote hosts) is served as-is.
 */
const SUPABASE_PUBLIC_OBJECT = /^(https:\/\/[a-z0-9-]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+)$/i;

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const match = src.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return src;
  const [, origin, objectPath] = match;
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality ?? 75),
    resize: "contain",
  });
  return `${origin}/storage/v1/render/image/public/${objectPath}?${params}`;
}
