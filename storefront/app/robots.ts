import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/api/", "/admin"],
    },
    sitemap: "https://www.eastcoastlabs.com.au/sitemap.xml",
  };
}
