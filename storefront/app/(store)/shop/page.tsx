import type { Metadata } from "next";
import { getCatalog, rankProductsByPopularity } from "@/lib/catalog";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import AccessoryGrid from "@/components/AccessoryGrid";
import ShopFilterGrid from "@/components/ShopFilterGrid";
import { decorateCards } from "@/lib/storefront-catalog";
import { getCollections } from "@/lib/collections";
import { getComingSoonProducts } from "@/lib/coming-soon";
import ComingSoonShelf from "@/components/ComingSoonShelf";
import type { CardProduct } from "@/components/ProductCard";

export const metadata: Metadata = {
  alternates: { canonical: "/shop" },
  title: "Shop research peptides",
  description:
    "Browse research-use-only peptides. Check available batch certificates before ordering.",
};

// Live catalog is fetched server-side (works despite CORS) with a 5-min revalidate.
export const revalidate = 300;

export default async function ShopPage() {
  const [{ products }, comingSoon] = await Promise.all([getCatalog(), getComingSoonProducts()]);
  const collections = getCollections();
  // Slim card data — avoids shipping heavy description HTML to the client filter.
  const rawCards: CardProduct[] = rankProductsByPopularity(products).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    is_in_stock: p.is_in_stock,
    images: p.images,
    prices: p.prices,
    tiers: p.tiers,
    sizes: p.sizes,
  }));
  // Live stock + published ratings, batched (server-only).
  const cards = await decorateCards(rawCards);

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Catalog</p>
        <h1 className="mt-2 text-3xl font-bold text-fg">Research peptides</h1>
        <p className="mt-2 text-sm text-muted">
          Compare current sizes, pack prices and availability. Pack options vary by product and live stock.
          Check certificate availability on each product page before ordering.
        </p>
        <ResearchDisclaimer variant="badge" className="mt-3" />
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-surface p-8 text-center text-muted">
          Catalog is temporarily unavailable. Please try again shortly.
        </div>
      ) : (
        <div className="mt-5 sm:mt-8">
          <ShopFilterGrid products={cards} collections={collections} />
        </div>
      )}

      {/* Research accessories */}
      <section className="mt-16">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-fg">Research accessories</h2>
          <p className="mt-1 text-sm text-muted">
            Everything you need to reconstitute and handle research material. Add to any order.
          </p>
        </div>
        <AccessoryGrid />
      </section>

      {/* Pipeline — sourcing candidates, with waitlist capture per compound */}
      <ComingSoonShelf products={comingSoon} />
    </div>
  );
}
