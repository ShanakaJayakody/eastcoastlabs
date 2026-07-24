import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/woo";
import { getCollections } from "@/lib/collections";
import { getGuides } from "@/lib/guides";

const BASE = "https://eastcoastlabs.com.au";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, guides] = await Promise.all([getProducts(50), getGuides()]);

  const staticRoutes = ["", "/shop", "/stacks", "/lab-results", "/learn", "/about", "/cart"].map(
    (path) => ({
      url: `${BASE}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    }),
  );

  const productRoutes = products.map((p) => ({
    url: `${BASE}/product/${p.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const collectionRoutes = getCollections().map((c) => ({
    url: `${BASE}/collections/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const guideRoutes = guides.map((g) => ({
    url: `${BASE}/learn/${g.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...collectionRoutes, ...guideRoutes, ...productRoutes];
}
