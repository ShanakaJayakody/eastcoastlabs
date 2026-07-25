import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProducts } from "@/lib/woo";
import { getCollection, getCollections } from "@/lib/collections";
import ProductCard from "@/components/ProductCard";
import { decorateCards } from "@/lib/storefront-catalog";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import Reveal from "@/components/Reveal";

export const revalidate = 300;

export function generateStaticParams() {
  return getCollections().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: `${collection.name} — Research Peptides`,
    description: collection.description,
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const products = await getProducts(50);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const items = await decorateCards(collection.products.map((s) => bySlug.get(s)).filter((p) => p != null));
  const others = getCollections().filter((c) => c.slug !== collection.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav className="mb-6 text-xs text-muted-2">
        <Link href="/shop" className="hover:text-accent">Shop</Link> <span className="mx-1">/</span>
        <span className="text-fg-2">{collection.name}</span>
      </nav>

      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Collection</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold text-fg sm:text-4xl">
          <span aria-hidden>{collection.icon}</span>
          {collection.name}
        </h1>
        <p className="mt-3 text-muted">{collection.description}</p>
        <ResearchDisclaimer className="mt-5" />
      </div>

      <Reveal className="stagger mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => (
          <ProductCard key={product!.id} product={product!} />
        ))}
      </Reveal>

      {/* Other collections */}
      <div className="mt-16 border-t border-line pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2">Other research goals</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="btn-press rounded-full border border-line bg-surface px-4 py-2 text-sm text-fg-2 transition-colors hover:border-accent/50 hover:text-fg"
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
