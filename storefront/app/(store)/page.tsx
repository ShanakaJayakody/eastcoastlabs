import Link from "next/link";
import Image from "next/image";
import { getCatalog } from "@/lib/catalog";
import { getLatestCoa } from "@/lib/coa";
import { getHomeCopy } from "@/lib/content";
import ProductCard from "@/components/ProductCard";
import { decorateCards } from "@/lib/storefront-catalog";
import CoaStrip from "@/components/CoaStrip";
import Faq from "@/components/Faq";
import TrustRow from "@/components/TrustRow";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import ReviewSummary from "@/components/ReviewSummary";
import { getSiteAggregate } from "@/lib/reviews";
import StackCard from "@/components/StackCard";
import { getStacks } from "@/lib/stacks";
import GuaranteeBand from "@/components/GuaranteeBand";
import Reveal from "@/components/Reveal";
import { getCollections } from "@/lib/collections";
import VariantTag from "@/components/VariantTag";

export const revalidate = 300;

const BESTSELLER_SLUGS = ["tesamorelin", "mots-c", "semax", "selank", "bpc-157", "tb-500", "glow", "ghk-cu"];

export default async function HomePage() {
  const [catalog, coa, copy, stacks] = await Promise.all([
    getCatalog(),
    getLatestCoa(6),
    getHomeCopy(),
    getStacks(),
  ]);
  const siteRating = await getSiteAggregate();
  const featuredStacks = stacks.slice(0, 2);
  const collections = getCollections();

  const { products, bySlug } = catalog;
  const bestsellers = BESTSELLER_SLUGS.map((s) => bySlug.get(s)).filter((p) => p != null).slice(0, 8);
  const grid = await decorateCards(bestsellers.length >= 4 ? bestsellers : products.slice(0, 8));

  // Hero visual: a featured vial (the teal BPC-157 render matches the accent).
  const heroProduct = bySlug.get("bpc-157") ?? grid[0] ?? products[0];
  const heroImage = heroProduct?.images?.[0]?.src;
  const heroBatch = coa[0]; // most-recent published COA for the floating proof card
  // Split the H1 into sentences so the final one can carry the accent gradient.
  const heroLines = copy.heroH1.split(/(?<=\.)\s+/).filter(Boolean);

  // Rising "molecular" particles in the hero visual (position/size/timing).
  const HERO_PARTICLES = [
    { left: "16%", size: 4, dur: 7.5, delay: 0 },
    { left: "30%", size: 3, dur: 9.5, delay: 1.6 },
    { left: "52%", size: 5, dur: 8, delay: 0.7 },
    { left: "66%", size: 3, dur: 10.5, delay: 2.3 },
    { left: "80%", size: 4, dur: 7, delay: 1.1 },
    { left: "44%", size: 2, dur: 11.5, delay: 3.1 },
    { left: "72%", size: 2, dur: 9, delay: 4 },
  ];

  const faqJsonLd =
    copy.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: copy.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <div>
      {/* Control arm of the /1 homepage split test. Renders nothing; stamps
          ecl_variant=control (first touch wins) for conversion attribution. */}
      <VariantTag variant="control" />

      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Fading clinical grid */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade" />
        {/* Drifting ambient accent glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-drift-1 absolute -top-32 right-[-6rem] h-[34rem] w-[34rem] rounded-full bg-accent/20 blur-[130px]" />
          <div className="animate-drift-2 absolute bottom-[-8rem] left-[10%] h-72 w-72 rounded-full bg-accent-2/10 blur-[110px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-24">
          {/* Copy column */}
          <div className="max-w-xl">
            <div
              className="hero-in inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-fg-2 backdrop-blur"
              style={{ animationDelay: "0.05s" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Independently tested by JanoShik · COA published before ship
            </div>

            <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-6xl">
              {heroLines.length > 1
                ? heroLines.map((line, i) => (
                    <span
                      key={i}
                      className="hero-in block"
                      style={{ animationDelay: `${0.15 + i * 0.12}s` }}
                    >
                      {i === heroLines.length - 1 ? (
                        <span className="text-gradient-animated">{line}</span>
                      ) : (
                        line
                      )}
                    </span>
                  ))
                : copy.heroH1}
            </h1>

            <p
              className="hero-in mt-5 max-w-md text-lg leading-relaxed text-muted"
              style={{ animationDelay: "0.5s" }}
            >
              {copy.heroSub}
            </p>

            {siteRating && (
              <div className="hero-in" style={{ animationDelay: "0.6s" }}>
                <ReviewSummary
                  rating={siteRating.rating}
                  count={siteRating.count}
                  size={16}
                  showSampleTag
                  className="mt-6"
                />
              </div>
            )}

            <div
              className="hero-in mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: "0.7s" }}
            >
              <Link
                href="/shop"
                className="btn-press rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-accent-ink shadow-lg shadow-accent/20 transition hover:brightness-95 hover:shadow-accent/30"
              >
                Shop bestsellers
              </Link>
              <Link
                href="/lab-results"
                className="btn-press rounded-lg border border-line bg-surface/60 px-6 py-3.5 text-sm font-semibold text-fg backdrop-blur transition hover:border-line-2 hover:border-accent/40"
              >
                See latest batch results →
              </Link>
            </div>

            <ResearchDisclaimer className="hero-in mt-6" />
          </div>

          {/* Visual column */}
          {heroImage && (
            <div className="hero-visual-in relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-square">
                {/* Rotating reactor-glow ring */}
                <div
                  className="animate-spin-slow absolute inset-6 rounded-full opacity-70 blur-[46px]"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent, var(--color-accent) 20%, transparent 45%, var(--color-accent-2) 70%, transparent 92%)",
                  }}
                />
                {/* Pulsing core glow */}
                <div className="animate-glow absolute inset-10 rounded-full bg-accent/25 blur-[80px]" />
                <div className="absolute inset-0 rounded-3xl border border-line/60 bg-gradient-to-b from-surface/40 to-transparent" />

                {/* Rising molecular particles */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  {HERO_PARTICLES.map((p, i) => (
                    <span
                      key={i}
                      className="particle"
                      style={{
                        left: p.left,
                        bottom: "14%",
                        width: p.size,
                        height: p.size,
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Vial (floats) with periodic shine sweep */}
                <div className="shine animate-float-slow absolute inset-0 overflow-hidden rounded-3xl">
                  <Image
                    src={heroImage}
                    alt="East Coast Labs research peptide vial"
                    fill
                    priority
                    sizes="(max-width: 1024px) 90vw, 45vw"
                    className="object-contain p-6 drop-shadow-2xl"
                  />
                </div>

                {/* Floating proof card — purity */}
                <div className="animate-float-slow-2 absolute -left-3 top-8 rounded-xl border border-line bg-surface/85 px-4 py-3 shadow-xl backdrop-blur sm:-left-6">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">🔬</span>
                    <div>
                      <p className="text-sm font-bold text-fg">≥ 98% purity</p>
                      <p className="text-[11px] text-muted">HPLC verified, every batch</p>
                    </div>
                  </div>
                </div>

                {/* Floating proof card — latest batch COA */}
                {heroBatch && (
                  <div className="animate-float-slow absolute -right-2 bottom-10 rounded-xl border border-line bg-surface/85 px-4 py-3 shadow-xl backdrop-blur sm:-right-5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/15 text-success">✓</span>
                      <div>
                        <p className="text-sm font-bold text-fg">
                          {heroBatch.purity_pct}% · Batch #{heroBatch.batch_id}
                        </p>
                        <p className="text-[11px] text-muted">Published COA · {heroBatch.lab}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
        <Reveal className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {grid.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Reveal>
        <div className="mt-6">
          <Link href="/shop" className="text-sm font-medium text-accent">
            Browse the full catalog →
          </Link>
        </div>
      </section>

      {/* Shop by research goal */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold text-fg">Shop by research goal</h2>
        <p className="mt-1 text-sm text-muted">Find the compounds studied for the outcome you&apos;re researching.</p>
        <Reveal className="stagger mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {collections.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="card-hover flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 hover:border-accent/40"
            >
              <span className="text-2xl" aria-hidden>{c.icon}</span>
              <span className="text-sm font-semibold text-fg">{c.name}</span>
              <span className="text-xs text-muted">{c.tagline}</span>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* Research stacks */}
      {featuredStacks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-fg">Research stacks — buy the set, save more</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                The peptides most commonly studied together, priced below single vials. One
                shipment, matching COAs.
              </p>
            </div>
            <Link href="/stacks" className="text-sm font-medium text-accent">
              View all stacks →
            </Link>
          </div>
          <Reveal className="stagger grid gap-6 sm:grid-cols-2">
            {featuredStacks.map((stack) => (
              <StackCard key={stack.slug} stack={stack} />
            ))}
          </Reveal>
        </section>
      )}

      {/* How testing works */}
      {copy.steps.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-xl font-semibold text-fg">How testing works</h2>
          <Reveal className="stagger mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, i) => (
              <div key={i} className="card-hover rounded-xl border border-line bg-surface p-5 hover:border-accent/40">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-sm font-bold text-accent">
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-semibold text-fg">{step.title}</p>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      {/* Trust row */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <TrustRow />
      </section>

      {/* Purity guarantee band */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <Reveal className="reveal">
          <GuaranteeBand />
        </Reveal>
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
          <Reveal className="reveal">
            <Faq items={copy.faq} />
          </Reveal>
        </section>
      )}
    </div>
  );
}
