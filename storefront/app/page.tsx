import Link from "next/link";
import { getProducts } from "@/lib/woo";
import { getLatestCoa } from "@/lib/coa";
import { getHomeCopy } from "@/lib/content";
import ProductCard from "@/components/ProductCard";
import CoaStrip from "@/components/CoaStrip";
import Faq from "@/components/Faq";
import TrustRow from "@/components/TrustRow";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";

export const revalidate = 300;

const BESTSELLER_SLUGS = ["tesamorelin", "mots-c", "semax", "selank", "bpc-157", "tb-500", "glow", "ghk-cu"];

export default async function HomePage() {
  const [products, coa, copy] = await Promise.all([getProducts(20), getLatestCoa(6), getHomeCopy()]);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const bestsellers = BESTSELLER_SLUGS.map((s) => bySlug.get(s)).filter((p) => p != null).slice(0, 8);
  const grid = bestsellers.length >= 4 ? bestsellers : products.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-grid">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-fg-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Independently tested by JanoShik · COA published before ship
            </div>
            <h1 className="mt-5 text-balance text-4xl font-bold leading-tight text-fg sm:text-5xl">
              {copy.heroH1}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{copy.heroSub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95"
              >
                Shop bestsellers
              </Link>
              <Link
                href="/lab-results"
                className="rounded-md border border-line bg-surface px-5 py-3 text-sm font-semibold text-fg transition hover:border-line-2"
              >
                See latest batch results →
              </Link>
            </div>
            <ResearchDisclaimer className="mt-6" />
          </div>
        </div>
      </section>

      {/* Live batch proof strip */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-fg">
              {copy.proofHeading || "Latest batch results — updated with every restock"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{copy.proofSupport}</p>
          </div>
          <Link href="/lab-results" className="text-sm font-medium text-accent">
            View all results →
          </Link>
        </div>
        <CoaStrip records={coa} />
      </section>

      {/* Bestsellers */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-fg">
            {copy.bestsellersHeading || "Bestselling research peptides"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{copy.bestsellersIntro}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {grid.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="mt-6">
          <Link href="/shop" className="text-sm font-medium text-accent">
            Browse the full catalog →
          </Link>
        </div>
      </section>

      {/* How testing works */}
      {copy.steps.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-xl font-semibold text-fg">How testing works</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-5">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-sm font-bold text-accent">
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-semibold text-fg">{step.title}</p>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust row */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <TrustRow />
      </section>

      {/* Restock promo */}
      {copy.restockBody && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-8">
            <h2 className="text-xl font-semibold text-fg">
              {copy.restockHeading || "Never run out of lab supplies"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">{copy.restockBody}</p>
          </div>
        </section>
      )}

      {/* FAQ */}
      {copy.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-5 text-xl font-semibold text-fg">Frequently asked questions</h2>
          <Faq items={copy.faq} />
        </section>
      )}
    </div>
  );
}
