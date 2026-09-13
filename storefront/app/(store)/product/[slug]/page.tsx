import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCatalogProduct, getCatalogProducts, type CatalogProduct } from "@/lib/catalog";
import { getCrossSellSlugs } from "@/lib/crosssells";
import { getCoaForProduct } from "@/lib/coa";
import { getProductCopy, getHomeCopy } from "@/lib/content";
import { minorToMajor } from "@/lib/format";
import ProductGallery from "@/components/ProductGallery";
import BuyBox from "@/components/BuyBox";
import SizedProductExperience from '@/components/SizedProductExperience';
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
import { getSettings } from "@/lib/settings";
import { getGuideForCompound } from "@/lib/guides";
import ProductDescription, { decodeProductEntities } from '@/components/ProductDescription';
import { buildProductJsonLd, serializeProductJsonLd } from '@/lib/product-jsonld';

export const revalidate = 300;

const stripHtml = (html: string) => decodeProductEntities(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();



export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) return { title: "Product not found" };
  const desc = stripHtml(product.short_description || product.description).slice(0, 160);
  return {
    title: product.seo_title || product.name,
    alternates: { canonical: `/product/${product.slug}` },
    description: product.seo_description || desc || `${product.name} — research-use-only product. Check available batch documentation before ordering.`,
    openGraph: {
      title: `${product.name} — East Coast Labs`,
      description: product.seo_description || desc,
      images: product.images?.[0]?.src ? [product.images[0].src] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ size?: string }> }) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  if (product.canonicalSlug) redirect(`/product/${product.canonicalSlug}?size=${encodeURIComponent(slug)}`);
  const initialSize = (await searchParams)?.size;

  const minorUnit = product.prices.currency_minor_unit;
  const selectedSize = product.sizes?.find((size) => size.slug === initialSize)
    ?? product.sizes?.find((size) => size.available > 0)
    ?? product.sizes?.[0];
  const singleMajor = minorToMajor(selectedSize?.priceMinor ?? product.prices.price, minorUnit);
  // Tiers come straight off the product's own variants, so what the page shows
  // and what checkout charges cannot drift apart.
  const tiers = product.tiers;

  const [copy, coa, homeCopy, guide, bySlug] = await Promise.all([
    getProductCopy(product.name, product.slug),
    getCoaForProduct(product.name, product.slug),
    getHomeCopy(),
    getGuideForCompound(product.slug),
    getCatalogProducts(["bacteriostatic-water",...getCrossSellSlugs(product.slug)]),
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

  const descriptor = stripHtml(product.short_description) || copy?.descriptor;
  const settings = await getSettings();
  const rating = await getAggregate(product.slug);

  const jsonLd = buildProductJsonLd({
    name: product.name, slug: product.slug, sku: product.sku,
    description: stripHtml(product.short_description || product.description).slice(0, 500),
    currency: product.prices.currency_code || 'AUD', images: (product.images ?? []).map((image) => image.src),
    sizes: product.sizes, price: singleMajor, available: product.is_in_stock, rating,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeProductJsonLd(jsonLd) }} />
      {!product.sizes?.length && <ViewItemTracker key={product.slug} slug={product.slug} name={product.name} price={singleMajor} />}

      {/* Breadcrumb */}
      <nav className="mb-6 text-xs text-muted-2">
        <a href="/shop" className="hover:text-accent">Shop</a> <span className="mx-1">/</span>
        <span className="text-fg-2">{product.name}</span>
      </nav>

      {product.sizes?.length ? (
        <SizedProductExperience
          key={`${product.slug}:${selectedSize?.slug ?? ''}`}
          product={{id:product.id,name:product.name,slug:product.slug,sku:product.sku,image:product.images?.[0]?.src,shortDescription:product.short_description,description:product.description}}
          sizes={product.sizes} minorUnit={minorUnit} initialSize={selectedSize?.slug} bacWater={bacWater}
          coa={coa} copyHtml={copy?.html} descriptorFallback={copy?.descriptor} guideSlug={guide?.slug}
          ratingSummary={rating ? <ReviewSummary rating={rating.rating} count={rating.count} showSampleTag /> : null}
          supportEmail={settings.supportEmail}
        />
      ) : <>
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="order-2 lg:col-start-1 lg:row-start-1 lg:row-span-2"><ProductGallery images={product.images ?? []} name={product.name} /></div>

        {/* Buy column */}
        <div className="order-1 min-w-0 lg:col-start-2">
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
          {descriptor && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{descriptor}</p>}
          {guide && (
            <a
              href={`/learn/${guide.slug}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              📖 Read the {product.name} research overview →
            </a>
          )}
          <ResearchDisclaimer variant="badge" className="mt-3" />
          <p className="mt-3 text-sm font-semibold text-accent">Single vial: {new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(singleMajor)}</p>
          <a href="#pack-options" className="mt-2 inline-block text-sm text-accent underline">View pack prices and availability</a>
        </div>
        <div id="pack-options" className="order-3 min-w-0 scroll-mt-24 lg:col-start-2">
          {product.is_in_stock === false ? (
            <div className="mt-6 rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-fg">Out of stock — get notified</p>
              <p className="mt-1 text-xs text-muted">
                We&apos;ll email you when this product is listed as available again.
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
                available={product.available}
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
      {(product.description || copy?.html) && (
        <section className="mt-12 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold text-fg">Product details</h2>
            <ProductDescription html={product.description || copy!.html} />
          </div>

          {/* Purchase information */}
          <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">Purchase information</h3>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                Check certificate availability and confirm that any published record applies to the product and batch you intend to order.
              </li>
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                Orders are prepared after payment confirmation. Shipping options appear at checkout.
              </li>
              <li className="flex gap-2">
                <span className="text-accent">✓</span>
                <a href="/returns" className="text-accent hover:underline">Read returns and consumer guarantee information.</a>
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted-2">
              Questions? <a href={`mailto:${settings.supportEmail}`} className="text-accent">{settings.supportEmail}</a>
            </p>
          </aside>
        </section>
      )}
      </>}

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
