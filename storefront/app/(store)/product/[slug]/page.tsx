import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, type CatalogProduct } from "@/lib/catalog";
import { getCrossSellSlugs } from "@/lib/crosssells";
import { getCoaForProduct } from "@/lib/coa";
import { getProductCopy, getHomeCopy } from "@/lib/content";
import { minorToMajor } from "@/lib/format";
import ProductGallery from "@/components/ProductGallery";
import BuyBox from "@/components/BuyBox";
import CoaModule from "@/components/CoaModule";
import TrustRow from "@/components/TrustRow";
import Faq from "@/components/Faq";
import ProductCard from "@/components/ProductCard";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import ViewItemTracker from "@/components/ViewItemTracker";
import ReviewSummary from "@/components/ReviewSummary";
import ReviewSection from "@/components/ReviewSection";
import EmailCapture from "@/components/EmailCapture";
import { getAggregate } from "@/lib/reviews";
import { getGuideForCompound } from "@/lib/guides";

export const revalidate = 300;

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();



export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { bySlug } = await getCatalog();
  const product = bySlug.get(slug);
  if (!product) return { title: "Product not found" };
  const desc = stripHtml(product.short_description || product.description).slice(0, 160);
  return {
    title: product.name,
    description: desc || `${product.name} — research-use-only peptide, independently tested.`,
    openGraph: {
      title: `${product.name} — East Coast Labs`,
      description: desc,
      images: product.images?.[0]?.src ? [product.images[0].src] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { products, bySlug } = await getCatalog();
  const product = bySlug.get(slug);
  if (!product) notFound();

  const minorUnit = product.prices.currency_minor_unit;
  const singleMajor = minorToMajor(product.prices.price, minorUnit);
  // Tiers come straight off the product's own variants, so what the page shows
  // and what checkout charges cannot drift apart.
  const tiers = product.tiers;

  const [copy, coa, homeCopy, guide] = await Promise.all([
    getProductCopy(product.name, product.slug),
    getCoaForProduct(product.name, product.slug),
    getHomeCopy(),
    getGuideForCompound(product.slug),
  ]);

  const bacWaterProduct = product.slug === "bacteriostatic-water" ? null : bySlug.get("bacteriostatic-water");
  const bacWater = bacWaterProduct
    ? {
        id: bacWaterProduct.id,
        name: bacWaterProduct.name,
        price: minorToMajor(bacWaterProduct.prices.price, bacWaterProduct.prices.currency_minor_unit),
        image: bacWaterProduct.images?.[0]?.src,
      }
    : null;

  const crossSells = getCrossSellSlugs(product.slug)
    .map((s) => bySlug.get(s))
    .filter((p): p is CatalogProduct => p != null && p.slug !== product.slug)
    .slice(0, 3);

  const descriptor = copy?.descriptor || stripHtml(product.short_description);
  const rating = await getAggregate(product.slug);

  // Product JSON-LD
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: (product.images ?? []).map((i) => i.src),
    description: stripHtml(product.short_description || product.description).slice(0, 500),
    brand: { "@type": "Brand", name: "East Coast Labs" },
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.rating.toFixed(1),
            reviewCount: rating.count,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: product.prices.currency_code || "AUD",
      price: singleMajor.toFixed(2),
      availability: product.is_in_stock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://eastcoastlabs.com.au/product/${product.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewItemTracker id={product.id} name={product.name} price={singleMajor} />

      {/* Breadcrumb */}
      <nav className="mb-6 text-xs text-muted-2">
        <a href="/shop" className="hover:text-accent">Shop</a> <span className="mx-1">/</span>
        <span className="text-fg-2">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <ProductGallery images={product.images ?? []} name={product.name} />

        {/* Buy column */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-2">
            <span className="uppercase tracking-wider">{product.sku}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                product.is_in_stock !== false ? "bg-success/15 text-success" : "bg-warn/15 text-warn"
              }`}
            >
              {product.is_in_stock !== false ? "In stock" : "Out of stock"}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-fg">{product.name}</h1>
          {rating && (
            <a href="#reviews" className="mt-2 inline-block transition-opacity hover:opacity-80">
              <ReviewSummary rating={rating.rating} count={rating.count} showSampleTag />
            </a>
          )}
          {descriptor && <p className="mt-3 text-sm leading-relaxed text-muted">{descriptor}</p>}
          {guide && (
            <a
              href={`/learn/${guide.slug}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              📖 Read the {product.name} research overview →
            </a>
          )}
          <ResearchDisclaimer variant="badge" className="mt-4" />

          {product.is_in_stock === false ? (
            <div className="mt-6 rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-fg">Out of stock — get notified</p>
              <p className="mt-1 text-xs text-muted">
                We&apos;ll email you the moment the next tested batch is listed.
              </p>
              <div className="mt-3">
                <EmailCapture
                  source={`back_in_stock:${product.slug}`}
                  cta="Notify me"
                  successMsg="✓ We'll email you when it's back."
                />
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <BuyBox
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  sku: product.sku,
                  image: product.images?.[0]?.src,
                }}
                tiers={tiers}
                singlePriceMinor={product.prices.price}
                minorUnit={minorUnit}
                bacWater={bacWater}
              />
            </div>
          )}
        </div>
      </div>

      {/* Trust row */}
      <div className="mt-12">
        <TrustRow />
      </div>

      {/* COA verification module */}
      <div className="mt-8">
        <CoaModule record={coa} />
      </div>

      {/* Description */}
      {copy?.html && (
        <section className="mt-12 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold text-fg">Product details</h2>
            <div className="prose-ecl" dangerouslySetInnerHTML={{ __html: copy.html }} />
          </div>

          {/* Guarantee block */}
          <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">Our guarantee</h3>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                Purity guaranteed — if an independent lab tests your batch below our guarantee, we
                refund or replace it and cover the cost of the test.
              </li>
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                Every batch independently tested by JanoShik, published before listing.
              </li>
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                1-business-day dispatch from Australia. Discreet packaging &amp; billing.
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted-2">
              Questions? <a href="mailto:eclpeptides@gmail.com" className="text-accent">eclpeptides@gmail.com</a>
            </p>
          </aside>
        </section>
      )}

      {/* FAQ */}
      {homeCopy.faq.length > 0 && (
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-5 text-lg font-semibold text-fg">Frequently asked questions</h2>
          <Faq items={homeCopy.faq} />
        </section>
      )}

      {/* Reviews */}
      <div id="reviews">
        <ReviewSection slug={product.slug} />
      </div>

      {/* Cross-sells */}
      {crossSells.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-lg font-semibold text-fg">Frequently researched together</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {crossSells.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <ResearchDisclaimer className="mt-12 text-center" />
    </div>
  );
}
