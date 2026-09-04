import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuide, getGuides } from "@/lib/guides";
import { getCatalog } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";

export const revalidate = 3600;

const SITE = "https://eastcoastlabs.com.au";

export function generateStaticParams() {
  return getGuides().then((gs) => gs.map((g) => ({ slug: g.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `${SITE}/learn/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: "article",
      url: `${SITE}/learn/${guide.slug}`,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  const [allGuides, { bySlug }] = await Promise.all([getGuides(), getCatalog()]);
  const relatedProducts = guide.compounds
    .map((c) => bySlug.get(c))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .slice(0, 3);
  const relatedGuides = allGuides.filter((g) => g.slug !== guide.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.updated,
    dateModified: guide.updated,
    author: { "@type": "Organization", name: "East Coast Labs" },
    publisher: { "@type": "Organization", name: "East Coast Labs" },
    mainEntityOfPage: `${SITE}/learn/${guide.slug}`,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-xs text-muted-2">
        <Link href="/learn" className="hover:text-accent">Research Hub</Link>
        <span className="mx-1">/</span>
        <span className="text-fg-2">{guide.title}</span>
      </nav>

      <article>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{guide.category}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-fg sm:text-4xl">{guide.title}</h1>
        <p className="mt-3 text-xs text-muted-2">
          {guide.readMins} min read{guide.updated ? ` · Updated ${guide.updated}` : ""}
        </p>

        <div className="prose-ecl mt-8" dangerouslySetInnerHTML={{ __html: guide.html }} />
      </article>

      {/* Shop the compound(s) this guide covers */}
      {relatedProducts.length > 0 && (
        <section className="mt-12 rounded-2xl border border-line bg-surface/50 p-6">
          <h2 className="text-base font-semibold text-fg">
            {relatedProducts.length === 1 ? "Shop this compound" : "Shop these compounds"}
          </h2>
          <p className="mt-1 text-sm text-muted">Independently tested, COA published before it ships.</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Related guides */}
      {relatedGuides.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-2">Keep reading</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {relatedGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/learn/${g.slug}`}
                className="card-hover rounded-xl border border-line bg-surface p-4 hover:border-accent/40"
              >
                <p className="text-sm font-semibold text-fg">{g.title}</p>
                <p className="mt-1 text-xs text-muted-2">{g.readMins} min read →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ResearchDisclaimer className="mt-12" />
    </div>
  );
}
