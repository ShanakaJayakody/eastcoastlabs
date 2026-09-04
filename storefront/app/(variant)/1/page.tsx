import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import { getAllCoa } from "@/lib/coa";
import { getHomeCopy } from "@/lib/content";
import { getStacks } from "@/lib/stacks";
import { getCollections } from "@/lib/collections";
import { getSiteAggregate, getRecentReviews } from "@/lib/reviews";
import { getSettings } from "@/lib/settings";
import { decorateCards } from "@/lib/storefront-catalog";
import VariantTag from "@/components/VariantTag";
import StickyCta from "@/components/variant/StickyCta";
import MastheadStrip from "@/components/variant/v2/MastheadStrip";
import ChapterMarker from "@/components/variant/v2/ChapterMarker";
import CertificateCard from "@/components/variant/v2/CertificateCard";
import SquareStars from "@/components/variant/v2/SquareStars";
import BatchTicker from "@/components/variant/v2/BatchTicker";
import LedgerTable from "@/components/variant/v2/LedgerTable";
import CatalogSection from "@/components/variant/v2/CatalogSection";
import MethodRule from "@/components/variant/v2/MethodRule";
import ProtocolCard from "@/components/variant/v2/ProtocolCard";
import ContractPanel from "@/components/variant/v2/ContractPanel";
import Testimony from "@/components/variant/v2/Testimony";
import DispatchGrid from "@/components/variant/v2/DispatchGrid";
import DossierFaq from "@/components/variant/v2/DossierFaq";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/env";

export const revalidate = 300;

/** `/1` is the A/B variant arm. Near-duplicate of `/` — never indexed. */
export const metadata: Metadata = {
  title: "Research peptides, independently tested — East Coast Labs",
  description:
    "Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik with the certificate of analysis published before it ships.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

const BESTSELLER_SLUGS = ["tesamorelin", "mots-c", "semax", "selank", "bpc-157", "tb-500", "glow", "ghk-cu"];

function formatProofDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

export default async function VariantHomePage() {
  const [catalog, coaAll, copy, stacks, settings, recentReviews] = await Promise.all([
    getCatalog(),
    getAllCoa(),
    getHomeCopy(),
    getStacks(),
    getSettings(),
    getRecentReviews(3),
  ]);
  const siteRating = await getSiteAggregate();
  const collections = getCollections();
  const featuredStacks = stacks.slice(0, 2);
  const ledgerRecords = coaAll.slice(0, 6);
  const latestBatch = coaAll[0];

  const { products, bySlug } = catalog;
  const bestsellers = BESTSELLER_SLUGS.map((s) => bySlug.get(s)).filter((p) => p != null).slice(0, 8);
  const grid = await decorateCards(bestsellers.length >= 4 ? bestsellers : products.slice(0, 8));

  const heroProduct = bySlug.get("bpc-157") ?? products[0];
  const heroImage = heroProduct?.images?.[0]?.src;

  return (
    <div>
      <VariantTag variant="v1" />
      <MastheadStrip items={settings.announcementItems} />

      {/* ══ 01 / THE CLAIM ══════════════════════════════════════ */}
      <section className="mx-auto max-w-[1200px] px-6">
        <ChapterMarker n="01" title="The Claim" />
        <div className="grid gap-12 py-12 lg:grid-cols-12 lg:gap-10 lg:py-20">
          <div className="lg:col-span-7 lg:border-r lg:border-line lg:pr-10">
            <p className="font-data text-[11px] uppercase tracking-[0.15em] text-accent">
              Research-grade peptides — Australia
            </p>
            <h1 className="font-serif-display mt-4 max-w-xl text-[2.6rem] leading-[1.03] tracking-tight text-fg sm:text-[3.4rem] lg:text-[3.8rem]">
              Every batch tested.
              <br />
              Every result published.
              <br />
              Before it ships.
            </h1>
            <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted">
              {copy.heroSub ||
                "Every vial is analysed by JanoShik, an independent laboratory, and the certificate goes public before the product is listed."}
            </p>

            {siteRating && (
              <div className="mt-6 flex items-center gap-2.5">
                <SquareStars rating={siteRating.rating} size={10} />
                <span className="font-data text-[12px] text-muted-2">
                  {siteRating.rating.toFixed(1)} ({siteRating.count} review{siteRating.count === 1 ? "" : "s"})
                </span>
              </div>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link
                href="/shop"
                className="border border-fg bg-fg px-7 py-3.5 font-data text-[13px] font-medium uppercase tracking-wide text-ink transition hover:opacity-85"
              >
                Browse the catalog
              </Link>
              <Link href="/lab-results" className="font-data text-[13px] uppercase tracking-wide text-accent underline underline-offset-4">
                Read our lab results →
              </Link>
            </div>

            {latestBatch && (
              <p className="mt-8 font-data text-[11px] tracking-wide text-muted-2">
                LATEST: BATCH {latestBatch.batch_id} · {latestBatch.compound.toUpperCase()} ·{" "}
                {latestBatch.purity_pct.toFixed(2)}% · {latestBatch.lab.toUpperCase()} ·{" "}
                {formatProofDate(latestBatch.test_date)}
              </p>
            )}

            <p className="mt-6 text-xs text-muted-2">
              Research use only — not for human or animal consumption.
            </p>
          </div>

          <div className="lg:col-span-5">
            {latestBatch ? (
              <CertificateCard record={latestBatch} />
            ) : heroImage ? (
              <div className="relative aspect-square border border-line-2 bg-ink-2">
                <Image
                  src={heroImage}
                  alt="East Coast Labs research peptide vial"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 40vw"
                  className="object-contain p-10"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ══ 02 / THE LEDGER ═════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-[1200px] px-6">
          <ChapterMarker n="02" title="The Ledger" />
          <div className="mb-8 mt-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif-display text-3xl text-fg">
              {copy.proofHeading || "Latest batch results"}
            </h2>
            <Link href="/lab-results" className="font-data text-[12px] uppercase tracking-wide text-accent underline underline-offset-2">
              Complete archive →
            </Link>
          </div>
        </div>
        <BatchTicker records={coaAll} />
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <LedgerTable records={ledgerRecords} />
        </div>
      </section>

      {/* ══ 03 / THE CATALOG ════════════════════════════════════ */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <ChapterMarker n="03" title="The Catalog" />
        <div className="mt-8">
          <CatalogSection products={grid} collections={collections} />
        </div>
        <div className="mt-8">
          <Link href="/shop" className="font-data text-[12px] uppercase tracking-wide text-accent underline underline-offset-2">
            Index: all {products.length} compounds →
          </Link>
        </div>
      </section>

      {/* ══ 04 / THE METHOD ═════════════════════════════════════ */}
      {copy.steps.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-6 py-16">
          <ChapterMarker n="04" title="The Method" />
          <h2 className="font-serif-display mt-6 text-3xl text-fg">Chain of custody</h2>
          <div className="mt-8">
            <MethodRule steps={copy.steps} />
          </div>
          <p className="font-serif-display mt-10 max-w-2xl text-lg italic leading-snug text-fg-2">
            "If any independent lab finds your batch below our stated purity, we refund it — and pay
            for the test."
          </p>
        </section>
      )}

      {/* ══ 05 / THE PROTOCOLS ══════════════════════════════════ */}
      {featuredStacks.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-6 py-16">
          <ChapterMarker n="05" title="The Protocols" />
          <div className="mb-8 mt-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif-display text-3xl text-fg">Filed together, priced together</h2>
            <Link href="/stacks" className="font-data text-[12px] uppercase tracking-wide text-accent underline underline-offset-2">
              View all protocols →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {featuredStacks.map((stack, i) => (
              <ProtocolCard key={stack.slug} stack={stack} index={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* ══ 06 / THE CONTRACT ═══════════════════════════════════ */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <ChapterMarker n="06" title="The Contract" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ContractPanel />
          <Testimony reviews={recentReviews} aggregate={siteRating} />
        </div>
      </section>

      {/* ══ 07 / DISPATCH ═══════════════════════════════════════ */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <ChapterMarker n="07" title="Dispatch" />
        <div className="mt-8">
          <DispatchGrid freeShippingThreshold={FREE_SHIPPING_THRESHOLD} />
        </div>
        {copy.faq.length > 0 && (
          <div className="mt-16">
            <h2 className="font-serif-display mb-2 text-2xl text-fg">Frequently asked questions</h2>
            <DossierFaq items={copy.faq} />
          </div>
        )}
      </section>

      <StickyCta />
    </div>
  );
}
