import type { Metadata } from "next";
import { getProducts } from "@/lib/woo";
import ProductCard from "@/components/ProductCard";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Shop research peptides",
  description:
    "Browse research-use-only peptides. Every batch independently tested by JanoShik with the COA published before it ships.",
};

// Live catalog is fetched server-side (works despite CORS) with a 5-min revalidate.
export const revalidate = 300;

export default async function ShopPage() {
  const products = await getProducts(20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Catalog</p>
        <h1 className="mt-2 text-3xl font-bold text-fg">Research peptides</h1>
        <p className="mt-3 text-sm text-muted">
          Every compound is available in 1-vial, 3-pack, and 6-pack options. The more you buy, the
          less you pay per vial. Every batch is independently tested by JanoShik.
        </p>
        <ResearchDisclaimer variant="badge" className="mt-4" />
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-surface p-8 text-center text-muted">
          Catalog is temporarily unavailable. Please try again shortly.
        </div>
      ) : (
        <Reveal className="stagger mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Reveal>
      )}

      <p className="mt-8 text-xs text-muted-2">
        Showing {products.length} products from the live catalog.
      </p>
    </div>
  );
}
