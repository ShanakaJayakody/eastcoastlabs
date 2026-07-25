import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getProducts } from "@/lib/woo";
import { getAllCoa } from "@/lib/coa";
import { getHomeCopy } from "@/lib/content";
import { getStacks } from "@/lib/stacks";
import { getCollections } from "@/lib/collections";
import { getSiteAggregate } from "@/lib/reviews";
import { getSettings } from "@/lib/settings";
import { decorateCards } from "@/lib/storefront-catalog";
import ProductCard from "@/components/ProductCard";
import CoaStrip from "@/components/CoaStrip";
import Faq from "@/components/Faq";
import StackCard from "@/components/StackCard";
import Reveal from "@/components/Reveal";
import ReviewSummary from "@/components/ReviewSummary";
import EmailCapture from "@/components/EmailCapture";
import TrustStrip from "@/components/variant/TrustStrip";
import MetricsBand, { type Metric } from "@/components/variant/MetricsBand";
import StickyCta from "@/components/variant/StickyCta";

export const revalidate = 300;

/**
 * `/1` is the A/B variant arm of the homepage test. It must never be indexed —
 * it is near-duplicate content of `/`, which stays canonical.
 */
export const metadata: Metadata = {
  title: "Research peptides, independently tested — East Coast Labs",
  description:
    "Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik with the certificate of analysis published before it ships.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

const BESTSELLER_SLUGS = ["tesamorelin", "mots-c", "semax", "selank", "bpc-157", "tb-500", "glow", "ghk-cu"];

export default async function VariantHomePage() {
  const [products, coaAll, copy, stacks, settings] = await Promise.all([
    getProducts(20),
    getAllCoa(),
    getHomeCopy(),
    getStacks(),
    getSettings(),
  ]);
  const siteRating = await getSiteAggregate();
  const collections = getCollections();
  const featuredStacks = stacks.slice(0, 2);
  const coa = coaAll.slice(0, 6);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const bestsellers = BESTSELLER_SLUGS.map((s) => bySlug.get(s)).filter((p) => p != null).slice(0, 8);
  const grid = await decorateCards(bestsellers.length >= 4 ? bestsellers : products.slice(0, 8));

  const heroProduct = bySlug.get("bpc-157") ?? products[0];
  const heroImage = heroProduct?.images?.[0]?.src;
  const heroBatch = coa[0];

  // Metrics are COMPUTED from real data — never asserted. Business-scale claims
  // (orders shipped, years trading) are deliberately absent until substantiated.
  const avgPurity =
    coaAll.length > 0 ? coaAll.reduce((s, r) => s + r.purity_pct, 0) / coaAll.length : 0;
  const metrics: Metric[] = [
    ...(coaAll.length > 0
      ? [
          {
            value: String(coaAll.length),
            label: "Batches published",
            sub: "Every COA on the Lab Results page",
          },
          {
            value: `${avgPurity.toFixed(2)}%`,
            label: "Average measured purity",
            sub: "Across all published batches",
          },
        ]
      : []),
    { value: String(products.length), label: "Compounds stocked", sub: "Research use only" },
    { value: "1 day", label: "Dispatch time", sub: "Business days, shipped from Australia" },
  ];

  return (
    <div>
      {/* ── Announcement bar ─────────────────────────────────────── */}
      <div className="border-b border-line bg-surface-2">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-8 px-4 py-2.5 text-center text-[11px] font-medium text-fg-2 sm:text-xs">
          {settings.announcementItems.map((item, i) => (
            <span key={item} className={i === 0 ? "" : i === 1 ? "hidden sm:inline" : "hidden lg:inline"}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Independently tested · Research use only
            </p>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]">
              Lab-grade peptides.
              <br />
              Independently tested.
              <br />
              <span className="text-accent">Proof published.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              {copy.heroSub ||
                "Every vial tested by JanoShik with the COA published before it ships. Australian owned, dispatched in 1 business day."}
            </p>

            {siteRating && (
              <ReviewSummary rating={siteRating.rating} count={siteRating.count} size={16} className="mt-6" />
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="btn-press rounded-lg bg-accent px-7 py-4 text-sm font-semibold text-accent-ink shadow-sm transition hover:brightness-110"
              >
                Shop peptides
              </Link>
              <Link
                href="/lab-results"
                className="btn-press rounded-lg border border-line-2 bg-surface px-7 py-4 text-sm font-semibold text-fg transition hover:border-accent hover:text-accent"
              >
                See our lab results
              </Link>
            </div>

            <p className="mt-6 text-xs text-muted-2">
              Research use only — not for human or animal consumption.
            </p>
          </div>

          {/* Visual: product on white with a real certificate card. No glow, no
              particles — the control page owns that language. */}
          {heroImage && (
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-square rounded-3xl border border-line bg-surface shadow-[0_30px_70px_-40px_rgba(12,18,32,0.45)]">
                <Image
                  src={heroImage}
                  alt="East Coast Labs research peptide vial"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-contain p-12"
                />
              </div>

              {heroBatch && (
                <div className="absolute -bottom-5 left-1/2 w-[min(22rem,92%)] -translate-x-1/2 rounded-xl border border-line bg-surface p-4 shadow-[0_18px_40px_-18px_rgba(12,18,32,0.35)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg">
                        {heroBatch.compound} · {heroBatch.purity_pct.toFixed(2)}% purity
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-2">
                        Batch #{heroBatch.batch_id} · {heroBatch.lab} · {heroBatch.test_date}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Trust pillars ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-16 lg:pt-20">
        <Reveal className="reveal">
          <TrustStrip />
        </Reveal>
      </section>

      {/* ── Latest verified batches ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-fg">
              {copy.proofHeading || "Latest batch results — updated with every restock"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.proofSupport}</p>
          </div>
          <Link href="/lab-results" className="link-sweep text-sm font-semibold text-accent">
            View all results →
          </Link>
        </div>
        <Reveal className="reveal">
          <CoaStrip records={coa} />
        </Reveal>
      </section>

      {/* ── Bestsellers ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            {copy.bestsellersHeading || "Bestselling research peptides"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.bestsellersIntro}</p>
        </div>
        <Reveal className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {grid.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Reveal>
        <div className="mt-8">
          <Link
            href="/shop"
            className="btn-press inline-block rounded-lg border border-line-2 bg-surface px-6 py-3 text-sm font-semibold text-fg transition hover:border-accent hover:text-accent"
          >
            Browse the full catalog →
          </Link>
        </div>
      </section>

      {/* ── Shop by research goal ────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-fg">Shop by research goal</h2>
        <p className="mt-2 text-sm text-muted">
          Find the compounds studied for the outcome you&apos;re researching.
        </p>
        <Reveal className="stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {collections.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="card-hover flex flex-col gap-2 rounded-xl border border-line bg-surface p-5 hover:border-accent"
            >
              <span className="text-2xl" aria-hidden>
                {c.icon}
              </span>
              <span className="text-sm font-semibold text-fg">{c.name}</span>
              <span className="text-xs leading-relaxed text-muted">{c.tagline}</span>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* ── Measured proof ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <Reveal className="reveal">
          <MetricsBand metrics={metrics} />
        </Reveal>
      </section>

      {/* ── How testing works ────────────────────────────────────── */}
      {copy.steps.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-fg">How our testing works</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The same four steps for every batch, with nothing tested in-house.
          </p>
          <Reveal className="stagger mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, i) => (
              <div key={i} className="relative border-t-2 border-line pt-5">
                <span className="absolute -top-[2px] left-0 h-[2px] w-10 bg-accent" aria-hidden />
                <p className="font-mono text-xs font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-sm font-semibold text-fg">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </Reveal>
          <div className="mt-8">
            <Link href="/lab-results" className="link-sweep text-sm font-semibold text-accent">
              See every published certificate →
            </Link>
          </div>
        </section>
      )}

      {/* ── Research stacks ──────────────────────────────────────── */}
      {featuredStacks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-fg">Research stacks</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                The peptides most commonly studied together, priced below single vials. One
                shipment, matching COAs.
              </p>
            </div>
            <Link href="/stacks" className="link-sweep text-sm font-semibold text-accent">
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

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      {copy.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-fg">Frequently asked questions</h2>
          <Reveal className="reveal">
            <Faq items={copy.faq} />
          </Reveal>
        </section>
      )}

      {/* ── Email capture ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            Batch releases and restock alerts
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            New COAs and back-in-stock notifications, sent when they happen. No sequences, no
            pressure.
          </p>
          <div className="mx-auto mt-6 max-w-md text-left">
            <EmailCapture source="variant_home_v1" cta="Keep me posted" placeholder="you@lab.com" />
          </div>
        </div>
      </section>

      <StickyCta />
    </div>
  );
}
