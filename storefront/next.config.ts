import type { NextConfig } from "next";

const WOO_API_BASE = process.env.WOO_API_BASE ?? "https://eastcoastlabs.com.au";
const WOO_CHECKOUT_BASE = process.env.WOO_CHECKOUT_BASE ?? "https://eastcoastlabs.com.au";

const nextConfig: NextConfig = {
  // Allows an isolated build output (e.g. NEXT_DIST_DIR=.next-verify) so a
  // verification build never clobbers a running dev server's .next chunks.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Surface the Woo base URLs to the browser bundle so the client-side cart and
  // the checkout hand-off can read them. These are non-secret public endpoints.
  env: {
    WOO_API_BASE,
    WOO_CHECKOUT_BASE,
    // Emergency fallback: "1" restores the legacy WooCommerce checkout hand-off.
    USE_WOO_CHECKOUT: process.env.USE_WOO_CHECKOUT ?? "",
  },
  // Enables forbidden()/unauthorized() so the admin can return a real 403 to an
  // authenticated-but-not-allow-listed user (see lib/admin/auth.ts).
  experimental: {
    authInterrupts: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "eastcoastlabs.com.au" },
      { protocol: "https", hostname: "**.eastcoastlabs.com.au" },
      // Product images uploaded to the `product-images` Supabase Storage bucket.
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
