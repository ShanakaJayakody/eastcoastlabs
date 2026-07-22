import type { NextConfig } from "next";

const WOO_API_BASE = process.env.WOO_API_BASE ?? "https://eastcoastlabs.com.au";
const WOO_CHECKOUT_BASE = process.env.WOO_CHECKOUT_BASE ?? "https://eastcoastlabs.com.au";

const nextConfig: NextConfig = {
  // Surface the Woo base URLs to the browser bundle so the client-side cart and
  // the checkout hand-off can read them. These are non-secret public endpoints.
  env: {
    WOO_API_BASE,
    WOO_CHECKOUT_BASE,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "eastcoastlabs.com.au" },
      { protocol: "https", hostname: "**.eastcoastlabs.com.au" },
    ],
  },
};

export default nextConfig;
