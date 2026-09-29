"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, FileCheck2, FileText, FlaskConical, MapPin, MessageCircle, PackageCheck, Plus } from "lucide-react";
import ProductCard, { type CardProduct } from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";
import StoreEnhancements from "@/components/StoreEnhancements";
import type { Collection } from "@/lib/collections";
import type { CoaRecord } from "@/lib/coa";
import type { LabReport } from "@/lib/lab-reports";
import { directions, questions } from "./content";
import { rebrandHref } from "@/lib/rebrand-navigation";
import NavyBrand from "./NavyBrand";
import NavyHeader from "./NavyHeader";
import ProductFinder from "./ProductFinder";

export interface RebrandProps {
  variant: "v2";
  products: CardProduct[];
  collections: Collection[];
  records: CoaRecord[];
  report: LabReport;
  productReports: Pick<LabReport, "productSlug" | "image" | "testDate" | "sample">[];
  reportCount: number;
  supportEmail: string;
  supportHours?: string;
  legalName?: string;
  abn?: string;
  paymentLabels?: string[];
}

function Hero() {
  return <section className="rb-hero" aria-labelledby="rb-hero-title">
    <div className="rb-hero-art">
      <Image src="/images/rebrand/navy-hero-2026.webp" alt="Five East Coast Labs research peptide vials with the blue ECL logo, arranged on blue glass and stone plinths" fill priority unoptimized sizes="100vw" />
    </div>
    <div className="rb-hero-shade" aria-hidden />
    <div className="rb-container rb-hero-inner">
      <div className="rb-hero-copy">
        <p className="rb-eyebrow"><span className="rb-small-rule" aria-hidden />Australian research peptides</p>
        <h1 id="rb-hero-title">Research Peptides<br />You Can Trust.<br /><span>Quality You Can<br className="rb-quality-break" /> Verify</span></h1>
        <p className="rb-intro">An Australian peptide supplier with clear product details, original lab reports and support before and after you order.</p>
        <div className="rb-actions">
          <a href="#collection" className="rb-button rb-button-light">Explore the peptides<ArrowUpRight size={19} aria-hidden /></a>
          <a href="#standards" className="rb-hero-report-link">See the lab reports<ArrowUpRight size={17} aria-hidden /></a>
        </div>
        <p className="rb-research-note">For laboratory research only.<br />Not for human or animal consumption.</p>
      </div>
      <div className="rb-hero-bottom">
        <a href="#collection" className="rb-discover"><ArrowDown size={16} aria-hidden />Explore the collection</a>
        <span>East Coast Labs<span className="rb-hero-dot" aria-hidden />Australian owned</span>
      </div>
    </div>
  </section>;
}

function TrustStrip() {
  return <div className="rb-trust"><div className="rb-container rb-trust-grid">
    <a href="#standards"><FileCheck2 size={25} strokeWidth={1.4} aria-hidden /><span><strong>See the original reports</strong><small>Documents you can read and verify</small></span><ArrowUpRight size={16} aria-hidden /></a>
    <a href="#ordering"><PackageCheck size={26} strokeWidth={1.4} aria-hidden /><span><strong>Shipped from Australia</strong><small>Tracked delivery, explained at checkout</small></span><ArrowUpRight size={16} aria-hidden /></a>
    <a href="#about"><MessageCircle size={25} strokeWidth={1.4} aria-hidden /><span><strong>Here when you have a question</strong><small>Product details, reports and order support</small></span><ArrowUpRight size={16} aria-hidden /></a>
  </div></div>;
}

function reportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

function CollectionSection({
  products,
  collections,
  variant,
  productReports,
}: Pick<RebrandProps, "products" | "collections" | "variant" | "productReports">) {
  const [filter, setFilter] = useState("all");
  const active = collections.find((item) => item.slug === filter);
  const visible = (
    active
      ? products.filter((product) => active.products.includes(product.slug))
      : products
  ).slice(0, 4);
  return (
    <section
      id="collection"
      className="rb-section rb-collection"
      aria-labelledby="rb-collection-title"
    >
      <div className="rb-container">
        <div className="rb-section-heading">
          <div>
            <p className="rb-eyebrow">The peptide collection</p>
            <h2 id="rb-collection-title">Find your research peptide.</h2>
          </div>
          <Link href={rebrandHref('/shop', variant)} className="rb-text-link">
            View all peptides <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="rb-section-description">
          Search the collection. Compare sizes. Find the details you need.
        </p>
        <ProductFinder products={products} variant={variant} />
        <div className="rb-filters" role="group" aria-label="Filter by research area">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Popular peptides
          </button>
          {collections.map((item) => (
            <button
              type="button"
              key={item.slug}
              aria-pressed={filter === item.slug}
              onClick={() => setFilter(item.slug)}
            >
              {item.slug === "metabolic-weight"
                ? "Metabolic research"
                : item.name}
            </button>
          ))}
        </div>
        <div className="rb-products" aria-live="polite">
          {visible.map((product) => {
            const supplierReport = productReports.find(
              (item) => item.productSlug === product.slug,
            );
            return (
              <div key={product.id} className="rb-product-with-report">
                <ProductCard
                  product={product}
                  imageVariant={variant}
                  listId={`rebrand_${variant}`}
                  listName="Research collection"
                />
                {supplierReport && (
                  <a
                    className="rb-product-report"
                    href={supplierReport.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open historical supplier report for ${supplierReport.sample}`}
                  >
                    <span>Supplier report <ArrowUpRight size={15} /></span>
                    <small>
                      Historical sample · {supplierReport.sample}
                    </small>
                    <small>
                      {reportDate(supplierReport.testDate)}
                    </small>
                  </a>
                )}
              </div>
            );
          })}
        </div>
        {!visible.length && (
          <div className="rb-empty" role="status">
            <FlaskConical size={30} strokeWidth={1.2} />
            <h3>
              {active
                ? "No products to show in this group."
                : "There are no products to show here."}
            </h3>
            <p>Try the full catalogue, or email us to check availability.</p>
            <Link href={rebrandHref('/shop', variant)} className="rb-text-link">
              Open the catalogue <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="rb-range-note">
          <span>Laboratory research materials</span>
          <span>Lab reports are linked where available. <a href="#standards">Understand what each report covers</a></span>
        </div>
      </div>
    </section>
  );
}

function EvidenceSection({
  variant,
  report,
  records,
  reportCount,
}: Pick<RebrandProps, "variant" | "report" | "records" | "reportCount">) {
  return (
    <section
      id="standards"
      className="rb-section rb-evidence"
      aria-labelledby="rb-evidence-title"
    >
      <div className="rb-container rb-evidence-grid">
        <div className="rb-evidence-copy">
          <p className="rb-eyebrow">A closer look at quality</p>
          <h2 id="rb-evidence-title">{directions[variant].proofTitle}</h2>
          <p className="rb-section-description">
            You should be able to read the evidence for yourself. We publish the
            original supplier documents, with sample details, results and links
            to verify them directly with the laboratory.
          </p>
          <ol className="rb-standards-list">
            <li>
              <span>1</span>
              <div>
                <h3>Open the original report</h3>
                <p>
                  Each supplier report includes a link to the laboratory’s
                  verification page, alongside the original report image.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Check the sample details</h3>
                <p>
                  The compound, sample size and measurements belong to the
                  sample named in the report. The date shows when it was tested.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Match the report to the supply</h3>
                <p>
                  These are historical supplier records. To confirm documentation
                  for the size and batch currently available, contact us with
                  the product name before ordering.
                </p>
              </div>
            </li>
          </ol>
          <Link href="/lab-results" className="rb-button rb-button-primary">
            Explore the report library <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="rb-report-stack">
          <div className="rb-report-card">
            <div className="rb-report-top">
              <span>From the supplier report library</span>
              <FileText size={21} strokeWidth={1.3} />
            </div>
            <div className="rb-report-heading">
              <h3>{report.compound} supplier report</h3>
              <p>Open the image to read the full document.</p>
            </div>
            <a
              className="rb-report-preview"
              href={report.image}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open original ${report.compound} supplier report ${report.taskNumber}`}
            >
              <Image
                unoptimized
                src={report.image}
                alt={`Historical Janoshik laboratory report for ${report.compound}, task ${report.taskNumber}`}
                width={640}
                height={880}
              />
            </a>
            <dl className="rb-report-fields">
              <div>
                <dt>Tested sample</dt>
                <dd>{report.compound}</dd>
              </div>
              <div>
                <dt>Report date</dt>
                <dd>
                  <time dateTime={report.testDate}>
                    {reportDate(report.testDate)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Document reference</dt>
                <dd>#{report.taskNumber}</dd>
              </div>
            </dl>
            <a
              href={report.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rb-report-verify"
            >
              Check this report on Janoshik <ArrowUpRight size={17} />
            </a>
            <p className="rb-report-footnote">
              This is a historical supplier report for the sample shown. It
              doesn’t confirm current stock or suitability for personal use.
            </p>
          </div>
          <div className="rb-report-caption">
            <FileCheck2 size={18} />
            <span>{reportCount} supplier reports in the library</span>
          </div>
        </div>
        {records.length > 0 && (
          <div className="rb-current-docs">
            <h3>Published batch documents</h3>
            <p>Check the batch number against the product you’re ordering.</p>
            {records.map((record) => (
              <a
                key={`${record.compound}-${record.batch_id}`}
                href={record.coa_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {record.compound}
                  <small>
                    Batch {record.batch_id} · {reportDate(record.test_date)}
                  </small>
                </span>
                <span>
                  Open document <ArrowUpRight size={16} />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AboutSection({ supportEmail, supportHours }: Pick<RebrandProps, "supportEmail" | "supportHours">) {
  return <section id="about" className="rb-section rb-about" aria-labelledby="rb-about-title">
    <div className="rb-container rb-about-grid">
      <div className="rb-about-image"><Image unoptimized src="/images/rebrand/coastal-women.webp" alt="Editorial portrait of two women beside the Australian coast" fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
      <div className="rb-about-copy">
        <p className="rb-eyebrow">An Australian company. An open conversation.</p>
        <h2 id="rb-about-title">You’re welcome<br />to ask us first.</h2>
        <p>Choosing a supplier shouldn’t mean working everything out on your own. If you’d like to check a product detail, understand a report or ask about delivery, get in touch.</p>
        <p>Send us the product name or your order number, and we’ll help with the details.</p>
        <a href={`mailto:${supportEmail}`} className="rb-button rb-button-primary">Contact East Coast Labs<ArrowUpRight size={18} aria-hidden /></a>
        <a className="rb-support-email" href={`mailto:${supportEmail}`}>{supportEmail}</a>
        {supportHours && <p className="rb-support-hours">{supportHours}</p>}
        <p className="rb-purpose-note">Product and order support. We don’t provide medical or dosing advice.</p>
      </div>
    </div>
  </section>;
}

function OrderingSection({ paymentLabels = [] }: Pick<RebrandProps, "paymentLabels">) {
  return <section id="ordering" className="rb-section rb-ordering" aria-labelledby="rb-ordering-title">
    <div className="rb-container">
      <div className="rb-section-heading"><div><p className="rb-eyebrow">From our range to your door</p><h2 id="rb-ordering-title">A straightforward order.</h2></div><Link href="/shipping" className="rb-text-link">Delivery information<ArrowUpRight size={17} aria-hidden /></Link></div>
      <div className="rb-ordering-grid">
        <article><span className="rb-step">01</span><h3>Choose your peptide</h3><p>Select your vial size and available pack. You’ll see the price and stock status before adding anything to your bag.</p><a href="#collection" className="rb-text-link">Browse the range<ArrowUpRight size={16} aria-hidden /></a></article>
        <article><span className="rb-step">02</span><h3>Review and pay</h3><p>Check your items and delivery option at checkout. {paymentLabels.length ? `Available payment options: ${paymentLabels.join(' or ')}.` : 'Your available payment options and instructions are shown there.'} We prepare your order after payment is confirmed.</p><Link href="/shipping" className="rb-text-link">Ordering information<ArrowUpRight size={16} aria-hidden /></Link></article>
        <article><span className="rb-step">03</span><h3>Follow your delivery</h3><p>Tracking details are provided when your shipment is recorded. If something arrives damaged or incorrect, contact us with your order reference.</p><Link href="/returns" className="rb-text-link">Help with an order<ArrowUpRight size={16} aria-hidden /></Link></article>
      </div>
    </div>
  </section>;
}

function FaqSection({ supportEmail }: Pick<RebrandProps, "supportEmail">) {
  return <section className="rb-section rb-faq" aria-labelledby="rb-faq-title"><div className="rb-container rb-faq-grid">
    <div className="rb-faq-intro"><p className="rb-eyebrow">Before you order</p><h2 id="rb-faq-title">A little more<br />information.</h2><p>Looking for a particular detail?<br />You can always ask us.</p><a href={`mailto:${supportEmail}`} className="rb-text-link">Get in touch<ArrowUpRight size={17} aria-hidden /></a></div>
    <div className="rb-faq-items">{questions.map((item, index) => <details id={`rb-question-${index}`} key={item.q}><summary>{item.q}<Plus size={19} aria-hidden /></summary><p>{item.a}</p></details>)}</div>
  </div></section>;
}

function Footer({ supportEmail, supportHours, legalName, abn }: Pick<RebrandProps, "supportEmail" | "supportHours" | "legalName" | "abn">) {
  return <footer className="rb-footer" id="contact"><div className="rb-container">
    <div className="rb-footer-top"><div><p className="rb-eyebrow">Explore East Coast Labs</p><h2>Find your next research peptide.</h2></div><Link href="/shop?rebrand=v2" className="rb-button rb-button-light">Shop the full range<ArrowUpRight size={18} aria-hidden /></Link></div>
    <div className="rb-footer-grid">
      <div className="rb-footer-brand"><NavyBrand footer /><p>Australian-owned supplier of laboratory research peptides.</p><span className="rb-location"><MapPin size={15} aria-hidden />Australia</span></div>
      <nav aria-label="Footer collection links"><h3>Explore</h3><Link href="/shop?rebrand=v2">Research peptides</Link><Link href="/lab-results">Lab reports</Link><a href="#about">About us</a><Link href="/learn">Research library</Link></nav>
      <nav aria-label="Customer information"><h3>Customer care</h3><Link href="/shipping">Shipping & delivery</Link><Link href="/returns">Returns policy</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link></nav>
      <div className="rb-footer-contact"><h3>Let’s talk</h3><a className="rb-support-email" href={`mailto:${supportEmail}`}>{supportEmail}</a>{supportHours && <p>{supportHours}</p>}<p>Questions about a product or an order?<br />We’re here to help.</p></div>
    </div>
    <div className="rb-footer-bottom"><span>© {new Date().getFullYear()} {legalName || 'East Coast Labs'}{abn ? ` · ABN ${abn}` : ''}</span><span>For laboratory research only. Not for human or animal consumption.</span></div>
  </div></footer>;
}

export default function RebrandExperience(props: RebrandProps) {
  return <div className="rebrand rb-v2" data-brand-variant="v2">
    <NavyHeader />
    <main id="main-content" tabIndex={-1}>
      <Hero /><TrustStrip /><CollectionSection {...props} /><EvidenceSection {...props} /><AboutSection {...props} /><OrderingSection {...props} /><FaqSection {...props} />
    </main>
    <Footer {...props} /><CartDrawer /><StoreEnhancements exitIntent={false} />
  </div>;
}
