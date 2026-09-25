"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  FileText,
  FlaskConical,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import ProductCard, { type CardProduct } from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";
import StoreEnhancements from "@/components/StoreEnhancements";
import VariantTag from "@/components/VariantTag";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { REBRAND_EXPERIMENT } from "@/lib/variant";
import type { Collection } from "@/lib/collections";
import type { CoaRecord } from "@/lib/coa";
import type { LabReport } from "@/lib/lab-reports";
import { directions, questions, type RebrandVariant } from "./content";
import { rebrandHref } from '@/lib/rebrand-imagery';

export interface RebrandProps {
  variant: RebrandVariant;
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
}
const nav = [
  { href: "#collection", label: "Research peptides" },
  { href: "#standards", label: "Lab reports" },
  { href: "#ordering", label: "Ordering & delivery" },
];

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

function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="rb-wordmark" aria-label="East Coast Labs home">
      <span>
        east coast<span className="rb-wordmark-dot">.</span>
      </span>
      <small>Labs Australia</small>
    </Link>
  );
}

function Header({ variant }: { variant: RebrandVariant }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const { itemCount } = useCart();
  const { openCart } = useUI();
  return (
    <>
      <a href="#main-content" className="rb-skip">
        Skip to content
      </a>
      <div className="rb-announcement">
        <span>Australian owned · Research use only</span>
        <Link href="/lab-results">
          Read the supplier lab reports <ArrowUpRight size={12} />
        </Link>
      </div>
      <header
        className="rb-header"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <div className="rb-container rb-header-inner">
          <Wordmark href={`/${variant.slice(1)}`} />
          <nav aria-label="Main navigation" className="rb-desktop-nav">
            {nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="rb-header-actions">
            <Link href={rebrandHref('/shop', variant)} className="rb-shop-link">
              View peptides <ArrowUpRight size={15} />
            </Link>
            <button
              type="button"
              className="rb-cart"
              aria-label={`Open shopping bag, ${itemCount} items`}
              onClick={openCart}
            >
              <ShoppingBag size={20} strokeWidth={1.5} />
              <span>{itemCount}</span>
            </button>
            <button
              type="button"
              ref={toggle}
              className="rb-menu-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="rb-mobile-nav"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="rb-mobile-nav"
            className="rb-mobile-nav"
            aria-label="Mobile navigation"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
                <ArrowUpRight size={18} />
              </a>
            ))}
            <Link href={rebrandHref('/shop', variant)}>
              View all products <ArrowUpRight size={18} />
            </Link>
            <Link href="/about">
              About East Coast Labs <ArrowUpRight size={18} />
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}

function Hero({
  variant,
  reportCount,
  supportEmail,
}: Pick<
  RebrandProps,
  "variant" | "reportCount" | "supportEmail"
>) {
  const copy = directions[variant];
  const science = variant === "v2";
  return (
    <section
      className={`rb-hero rb-hero-${variant}`}
      aria-labelledby="rb-hero-title"
    >
      <div className="rb-container rb-hero-grid">
        <div className="rb-hero-copy">
          <p className="rb-eyebrow">{copy.eyebrow}</p>
          <h1 id="rb-hero-title">{copy.heading}</h1>
          <p className="rb-intro">{copy.intro}</p>
          <div className="rb-actions">
            <Link
              href="#collection"
              className="rb-button rb-button-primary"
            >
              {copy.primary}
              <ArrowUpRight size={18} />
            </Link>
            <Link
              href={variant === "v3" ? `mailto:${supportEmail}` : "/lab-results"}
              className="rb-text-link"
            >
              {copy.secondary}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rb-hero-notes">
            <span>Shipping from Australia</span>
          </div>
          <p className="rb-research-note">
            For laboratory research only. Not for human or animal consumption.
          </p>
        </div>
        {!science && (
          <div className="rb-welcome-photo rb-hero-visual">
            <Image
              unoptimized
              src="/images/rebrand/coastal-women.webp"
              alt="Editorial image of two women enjoying the Australian coast"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 50vw"
            />
          </div>
        )}
        {science && (
          <div className="rb-science-art rb-hero-visual">
            <div className="rb-science-art-top">
              <span>Our research peptides</span>
              <FlaskConical size={18} strokeWidth={1.2} />
            </div>
            <Image
              unoptimized
              src="/images/rebrand/research-collection-v2.webp"
              alt="East Coast Labs research vials arranged on pale blue glass plinths"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 50vw"
            />
            <Link href="/lab-results" className="rb-science-proof">
              <FileCheck2 size={25} strokeWidth={1.4} />
              <span>
                <strong>{reportCount} original supplier reports</strong>
                <small>Read the original documents</small>
              </span>
              <ArrowUpRight size={20} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <div className="rb-trust">
      <div className="rb-container rb-trust-grid">
        <Link href="/lab-results">
          <FileCheck2 size={24} strokeWidth={1.3} />
          <span>
            Original supplier reports
            <small>Sample details and laboratory links</small>
          </span>
          <ArrowUpRight size={16} />
        </Link>
        <a href="#ordering">
          <MapPin size={24} strokeWidth={1.3} />
          <span>
            Shipping from Australia
            <small>How payment and dispatch work</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
        <a href="#about">
          <MessageCircle size={24} strokeWidth={1.3} />
          <span>
            Product and order support
            <small>Contact us before or after you buy</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
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
            <p className="rb-eyebrow">Our research peptides</p>
            <h2 id="rb-collection-title">{directions[variant].rangeTitle}</h2>
          </div>
          <Link href={rebrandHref('/shop', variant)} className="rb-text-link">
            View all peptides <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="rb-section-description">
          Choose a research area below, or open a product to see its sizes,
          price and availability.
        </p>
        <div className="rb-filters" aria-label="Filter by research area">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All research areas
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
                      Historical: {supplierReport.sample}
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
          <span>Supplier reports describe historical samples, not current stock. <a href="#standards">About the reports</a></span>
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
          <p className="rb-eyebrow">Laboratory documentation</p>
          <h2 id="rb-evidence-title">{directions[variant].proofTitle}</h2>
          <p className="rb-section-description">
            We publish the original supplier reports with their sample details,
            dates and results intact. You can open the full document and follow
            its verification link to Janoshik.
          </p>
          <ol className="rb-standards-list">
            <li>
              <span>1</span>
              <div>
                <h3>The laboratory’s original document</h3>
                <p>
                  Each supplier report includes a link to the laboratory’s
                  verification page, alongside the original report image.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>The sample and test date</h3>
                <p>
                  The compound, sample size and measurements belong to the
                  sample named in the report. The date shows when it was tested.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Which supply the report covers</h3>
                <p>
                  These are historical supplier records. To confirm documentation
                  for the size and batch currently available, contact us with
                  the product name before ordering.
                </p>
              </div>
            </li>
          </ol>
          <Link href="/lab-results" className="rb-button rb-button-primary">
            Read all lab reports <ArrowUpRight size={18} />
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

function AboutSection({
  variant,
  supportEmail,
  supportHours,
}: Pick<RebrandProps, "variant" | "supportEmail" | "supportHours">) {
  return (
    <section id="about" className="rb-about" aria-labelledby="rb-about-title">
      <div className="rb-about-image">
        <Image
          unoptimized
          src={
            variant === "v2"
              ? "/images/rebrand/coastal-women.webp"
              : "/images/editorial/coastal-study.webp"
          }
          alt={
            variant === "v2"
              ? "Editorial image of two women beside the Australian coast"
              : "Ocean surf along the Australian coastline"
          }
          fill
          sizes="(max-width: 800px) 100vw, 50vw"
        />
      </div>
      <div className="rb-about-copy">
        <p className="rb-eyebrow">Contact East Coast Labs</p>
        <h2 id="rb-about-title">{directions[variant].aboutTitle}</h2>
        <p>{directions[variant].aboutCopy}</p>
        <Link href={`mailto:${supportEmail}`} className="rb-text-link">
          Email East Coast Labs <ArrowUpRight size={17} />
        </Link>
        <a className="rb-support-email" href={`mailto:${supportEmail}`}>{supportEmail}</a>
        {supportHours && <p className="rb-support-hours">{supportHours}</p>}
        <div className="rb-purpose-note">
          We can help with product documentation and orders. We don’t provide
          medical or dosing advice.
        </div>
      </div>
    </section>
  );
}

function OrderingSection() {
  const articles = [
    {
      title: "Shipped from Australia",
      href: "/shipping",
      detail:
        "We ship to Australian addresses. The available services and total are shown at checkout, with tracking details provided when your shipment is recorded.",
      cta: "Delivery information",
    },
    {
      title: "Payment by bank transfer",
      href: "/shipping",
      detail:
        "Place your order to receive the transfer details, exact amount and reference. We prepare your order after payment is confirmed.",
      cta: "How payment works",
    },
    {
      title: "Help if something’s wrong",
      href: "/returns",
      detail:
        "If an order arrives damaged, incorrect or goes missing, contact us with your order reference. Our returns page explains how we look into it and what to send us.",
      cta: "Order problems and returns",
    },
  ];
  return (
    <section
      id="ordering"
      className="rb-section rb-ordering"
      aria-labelledby="rb-ordering-title"
    >
      <div className="rb-container">
        <div className="rb-section-heading">
          <div>
            <p className="rb-eyebrow">Ordering & delivery</p>
            <h2 id="rb-ordering-title">What happens when you order</h2>
          </div>
        </div>
        <div className="rb-ordering-grid">
          {articles.map((article) => (
            <article key={article.title}>
              <h3>{article.title}</h3>
              <p>{article.detail}</p>
              <Link href={article.href} className="rb-text-link">
                {article.cta} <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="rb-section rb-faq" aria-labelledby="rb-faq-title">
      <div className="rb-container rb-faq-grid">
        <div>
          <p className="rb-eyebrow">Useful information</p>
          <h2 id="rb-faq-title">A few common questions</h2>
        </div>
        <div className="rb-faq-items">
          {questions.map((item, index) => (
            <details id={`rb-question-${index}`} key={item.q}>
              <summary>
                {item.q}
                <Plus size={19} />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({
  variant,
  supportEmail,
  supportHours,
  legalName,
  abn,
}: Pick<
  RebrandProps,
  "variant" | "supportEmail" | "supportHours" | "legalName" | "abn"
>) {
  return (
    <footer id="contact" className="rb-footer">
      <div className="rb-container">
        <div className="rb-footer-top">
          <div>
            <p className="rb-eyebrow">Product and order enquiries</p>
            <h2>Contact East Coast Labs</h2>
          </div>
          <a
            href={`mailto:${supportEmail}`}
            className="rb-button rb-button-light"
          >
            Email us <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="rb-footer-grid">
          <div>
            <Wordmark href={`/${variant.slice(1)}`} />
            <p>
              An Australian-owned supplier
              <br />
              of laboratory research peptides.
            </p>
            <span className="rb-location">
              <MapPin size={14} /> Australian owned
            </span>
          </div>
          <nav aria-label="Footer collection links">
            <h3>Products and reports</h3>
            <Link href={rebrandHref('/shop', variant)}>Research peptides</Link>
            <Link href="/lab-results">Laboratory reports</Link>
            <a href="#ordering">Ordering & delivery</a>
            <Link href="/about">About East Coast Labs</Link>
          </nav>
          <nav aria-label="Customer information">
            <h3>Ordering</h3>
            <Link href="/shipping">Shipping & delivery</Link>
            <Link href="/returns">Returns policy</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms & conditions</Link>
          </nav>
          <div>
            <h3>Contact</h3>
            <a className="rb-support-email" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            {supportHours && <p>{supportHours}</p>}
            <p>
              Include the product name or your order number so we can help with
              the right details.
            </p>
          </div>
        </div>
        <div className="rb-footer-bottom">
          <span>
            © {new Date().getFullYear()} {legalName || "East Coast Labs"}
            {abn ? ` · ABN ${abn}` : ""}
          </span>
          <span>
            For laboratory research only. Not for human or animal consumption.
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function RebrandExperience(props: RebrandProps) {
  const { variant } = props;
  return (
    <div className={`rebrand rb-${variant}`} data-brand-variant={variant}>
      <VariantTag variant={variant} experiment={REBRAND_EXPERIMENT} />
      <Header variant={variant} />
      <main id="main-content" tabIndex={-1}>
        <Hero {...props} />
        <TrustStrip />
        <CollectionSection {...props} />
        <EvidenceSection {...props} />
        <OrderingSection />
        <AboutSection variant={variant} supportEmail={props.supportEmail} supportHours={props.supportHours} />
        <FaqSection />
      </main>
      <Footer {...props} />
      <CartDrawer />
      <StoreEnhancements exitIntent={false} />
    </div>
  );
}
