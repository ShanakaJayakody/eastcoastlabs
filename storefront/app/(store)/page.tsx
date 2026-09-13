import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  PackageCheck,
  FileText,
  MapPin,
  Plus,
} from "lucide-react";
import { getCatalog, rankAvailableProductsByPopularity } from "@/lib/catalog";
import { getLatestCoa } from "@/lib/coa";
import { labReports } from "@/lib/lab-reports";
import { getHomeCopy } from "@/lib/content";
import { decorateCards } from "@/lib/storefront-catalog";
import { getCollections } from "@/lib/collections";
import Faq from "@/components/Faq";
import VariantTag from "@/components/VariantTag";
import EditorialMotion from "@/components/editorial/Motion";
import FeaturedRange from "@/components/editorial/FeaturedRange";
import ResearchExplorer from "@/components/editorial/ResearchExplorer";
import Documentation from "@/components/editorial/Documentation";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [catalog, records, copy] = await Promise.all([
    getCatalog(),
    getLatestCoa(3),
    getHomeCopy(),
  ]);
  const products = await decorateCards(
    rankAvailableProductsByPopularity(catalog.products),
  );
  const collections = getCollections();
  const previews = collections.map((collection) => {
    const product = collection.products
      .map((slug) => catalog.bySlug.get(slug))
      .find((item) => item?.images?.length);
    return {
      ...collection,
      image: product?.images?.[0]?.src,
      productName: product?.name,
    };
  });
  const faqJsonLd = copy.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: copy.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

  return (
    <EditorialMotion>
      <VariantTag variant="control" />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <section className="ecl-hero ecl-hero-five" aria-labelledby="hero-title">
        <div className="ecl-hero-art">
          <Image
            src="/images/editorial/five-vial-campaign.webp"
            alt="Five East Coast Labs vials — BPC-157, GHK-Cu, Retatrutide, Tesamorelin and KLOW — arranged on sea-glass plinths"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
        </div>
        <div className="ecl-hero-shade" />
        <div className="ecl-container ecl-hero-inner">
          <div className="ecl-hero-copy">
            <p className="ecl-eyebrow ecl-hero-enter">
              <span className="ecl-live-dot" /> EAST COAST LABS / AUSTRALIAN
              OWNED
            </p>
            <h1 id="hero-title" className="ecl-hero-enter">
              Premium peptides. <br />
              Buy with <br />
              <em>confidence.</em>
            </h1>
            <p className="ecl-hero-description ecl-hero-enter">
              Clear pricing. Original lab reports. A local team here to help.
              <br className="ecl-desktop-break" /> A more considered way to
              choose your peptides.
            </p>
            <div className="ecl-hero-actions ecl-hero-enter">
              <Link href="/shop" className="ecl-button ecl-button-primary">
                Shop peptides <ArrowUpRight size={19} />
              </Link>
              <Link href="/lab-results" className="ecl-hero-secondary">
                View lab reports <ArrowUpRight size={15} />
              </Link>
            </div>
            <p className="ecl-hero-disclaimer ecl-hero-enter">
              For laboratory research only. Not for human or animal consumption.
            </p>
          </div>
          <span className="ecl-hero-register" aria-hidden>
            <Plus size={18} /> ECL / 001
          </span>
          <div className="ecl-hero-bottom">
            <a href="#featured" className="ecl-scroll-cue">
              <ArrowDown size={17} />
              <span>DISCOVER WHAT&apos;S NEXT</span>
            </a>
            <Link href="#featured" className="ecl-hero-product">
              <span>
                The signature five
                <small>Discover our most popular peptides</small>
              </span>
              <ArrowUpRight size={20} />
            </Link>
          </div>
        </div>
      </section>
      <div className="ecl-trust-strip">
        <div className="ecl-container">
          <div>
            <MapPin size={21} strokeWidth={1.3} />
            <span>
              Australian owned<small>A local team, here to help</small>
            </span>
          </div>
          <Link href="/lab-results">
            <FileText size={21} strokeWidth={1.3} />
            <span>
              Original Janoshik reports
              <small>View the samples, dates & source documents</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/shop">
            <PackageCheck size={22} strokeWidth={1.3} />
            <span>
              Options that work for you
              <small>Single vials & available pack pricing</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <FeaturedRange products={products} collections={collections} />
      <ResearchExplorer collections={previews} />
      <Documentation records={records} reports={labReports} />
      <section className="ecl-story" aria-labelledby="story-title">
        <div className="ecl-story-image">
          <Image
            src="/images/editorial/coastal-study.webp"
            alt="An atmospheric study of ocean surf and a rocky Australian-style coastline"
            fill
            unoptimized
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>
        <div className="ecl-story-copy" data-reveal>
          <p className="ecl-eyebrow">FROM THE EAST COAST. FOR THE CURIOUS.</p>
          <h2 id="story-title">
            Grounded here.
            <br />
            <em>Looking ahead.</em>
          </h2>
          <p>
            We&apos;re an Australian-owned research supplier with a
            straightforward belief: choosing your research materials should feel
            informed, considered and clear.
          </p>
          <p>
            From exploring a compound to understanding your order, we&apos;re
            here to make the details easier to navigate.
          </p>
          <Link href="/about" className="ecl-text-link">
            Meet East Coast Labs <ArrowUpRight size={18} />
          </Link>
          <span className="ecl-story-signature">
            EAST COAST LABS <span>AUSTRALIA</span>
          </span>
        </div>
      </section>
      <section className="ecl-section ecl-knowledge">
        <div className="ecl-container ecl-knowledge-inner" data-reveal>
          <div>
            <p className="ecl-eyebrow">KEEP ASKING QUESTIONS</p>
            <h2>
              Curiosity is a <em>good start.</em>
            </h2>
            <p>
              Build your understanding with compound overviews and research
              fundamentals.
            </p>
          </div>
          <Link href="/learn" className="ecl-button ecl-button-outline">
            Explore the research library <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      {copy.faq.length > 0 && (
        <section className="ecl-paper ecl-section ecl-faq-section">
          <div className="ecl-container ecl-faq-layout" data-reveal>
            <div>
              <p className="ecl-eyebrow">A LITTLE MORE CLARITY</p>
              <h2>
                Good questions.
                <br />
                <em>Clear answers.</em>
              </h2>
              <Link href="/about" className="ecl-text-link">
                More about us <ArrowUpRight size={17} />
              </Link>
            </div>
            <Faq items={copy.faq} />
          </div>
        </section>
      )}
    </EditorialMotion>
  );
}
