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

export interface RebrandProps {
  variant: RebrandVariant;
  products: CardProduct[];
  collections: Collection[];
  records: CoaRecord[];
  report: LabReport;
  reportCount: number;
  supportEmail: string;
  supportHours?: string;
  legalName?: string;
  abn?: string;
}
const nav = [
  { href: "#collection", label: "Products" },
  { href: "#standards", label: "Lab reports" },
  { href: "#journal", label: "Before you order" },
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
            <Link href="/shop" className="rb-shop-link">
              View products <ArrowUpRight size={15} />
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
            <Link href="/shop">
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
  report,
  supportEmail,
  supportHours,
}: Pick<
  RebrandProps,
  "variant" | "reportCount" | "report" | "supportEmail" | "supportHours"
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
          <h1 id="rb-hero-title">
            {copy.heading} <br />
            <span>{copy.emphasis}</span>
          </h1>
          <p className="rb-intro">{copy.intro}</p>
          <div className="rb-actions">
            <Link
              href={
                science
                  ? "/lab-results"
                  : variant === "v3"
                    ? `mailto:${supportEmail}`
                    : "#collection"
              }
              className="rb-button rb-button-primary"
            >
              {copy.primary}
              <ArrowUpRight size={18} />
            </Link>
            <Link
              href={variant === "v1" ? "/lab-results" : "#collection"}
              className="rb-text-link"
            >
              {copy.secondary}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rb-hero-notes">
            <span>Original supplier lab reports</span>
            <span>Australian contact details</span>
          </div>
          <p className="rb-research-note">
            For laboratory research only. Not for human or animal consumption.
          </p>
        </div>
        {variant === "v1" && (
          <figure className="rb-document-hero">
            <div className="rb-document-heading">
              <span>A report you can check</span>
              <span>Janoshik · #{report.taskNumber}</span>
            </div>
            <a
              href={report.image}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Read the original ${report.compound} supplier report`}
            >
              <Image
                unoptimized
                src={report.image}
                alt={`Original ${report.compound} supplier report, dated ${reportDate(report.testDate)}`}
                width={640}
                height={880}
                priority
              />
            </a>
            <figcaption>
              <strong>
                {report.compound} · {reportDate(report.testDate)}
              </strong>
              <span>
                Historical supplier report. Results apply to the tested sample.
              </span>
            </figcaption>
          </figure>
        )}
        {variant === "v3" && (
          <aside
            className="rb-contact-card"
            aria-labelledby="rb-contact-card-title"
          >
            <p className="rb-eyebrow">Contact East Coast Labs</p>
            <h2 id="rb-contact-card-title">Send us your question</h2>
            <p>
              Include the product name, a report link or your order number. That
              helps us get to the detail you need.
            </p>
            <a href={`mailto:${supportEmail}`} className="rb-contact-address">
              {supportEmail}
              <ArrowUpRight size={18} />
            </a>
            {supportHours && <p className="rb-contact-hours">{supportHours}</p>}
            <div className="rb-contact-scope">
              We can help with product information and orders. We don’t provide
              medical or dosing advice.
            </div>
          </aside>
        )}
        {science && (
          <div className="rb-science-art">
            <div className="rb-science-art-top">
              <span>Our research peptides</span>
              <FlaskConical size={18} strokeWidth={1.2} />
            </div>
            <Image
              unoptimized
              src="/images/rebrand/research-collection.webp"
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
            Read the original reports
            <small>Check the sample, date and result</small>
          </span>
          <ArrowUpRight size={16} />
        </Link>
        <a href="#standards">
          <FlaskConical size={24} strokeWidth={1.3} />
          <span>
            Check which batch a report covers
            <small>Ask us before you order</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
        <a href="#contact">
          <MessageCircle size={24} strokeWidth={1.3} />
          <span>
            Contact East Coast Labs
            <small>Send us your product or order question</small>
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
}: Pick<RebrandProps, "products" | "collections" | "variant">) {
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
          <Link href="/shop" className="rb-text-link">
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
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              listId={`rebrand_${variant}`}
              listName="Research collection"
            />
          ))}
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
            <Link href="/shop" className="rb-text-link">
              Open the catalogue <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="rb-range-note">
          <span>Laboratory research materials</span>
          <span>Sizes and availability are listed on each product page.</span>
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
          <p className="rb-eyebrow">Checking the documentation</p>
          <h2 id="rb-evidence-title">{directions[variant].proofTitle}</h2>
          <p className="rb-section-description">
            A laboratory report should tell you what was tested and what the lab
            found. Here’s how to check the documents we publish, including what
            they can and can’t confirm.
          </p>
          <ol className="rb-standards-list">
            <li>
              <span>1</span>
              <div>
                <h3>Open the original report</h3>
                <p>
                  Our supplier reports include a Janoshik verification link. You
                  can check the report on the laboratory’s own website.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Read the sample details</h3>
                <p>
                  Check the compound, test date and measurements. A result
                  belongs to the sample named in that document.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Match it to the batch</h3>
                <p>
                  An older report doesn’t tell you which batch you’ll receive.
                  Ask us which documents apply to the product you want to order.
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
}: Pick<RebrandProps, "variant" | "supportEmail">) {
  return (
    <section id="about" className="rb-about" aria-labelledby="rb-about-title">
      <div className="rb-about-copy">
        <p className="rb-eyebrow">A note from East Coast Labs</p>
        <h2 id="rb-about-title">{directions[variant].aboutTitle}</h2>
        <p>{directions[variant].aboutCopy}</p>
        <p>
          We’re an Australian-owned supplier of laboratory research peptides.
          You can contact us about product specifications, supplier reports or
          an existing order.
        </p>
        <Link href={`mailto:${supportEmail}`} className="rb-text-link">
          Email East Coast Labs <ArrowUpRight size={17} />
        </Link>
        <div className="rb-purpose-note">
          Our products are for laboratory research only. They are not for human
          or animal use.
        </div>
      </div>
    </section>
  );
}

function Journal({ report }: { report: LabReport }) {
  const articles = [
    {
      category: "A sample report",
      title: "What does a lab report look like?",
      href: report.image,
      detail:
        "Open the GHK-Cu supplier report and find the sample name, test date and results.",
      cta: "Open a sample report",
    },
    {
      category: "Understanding purity",
      title: "What can a purity result tell you?",
      href: "#rb-question-1",
      detail:
        "A purity percentage has limits. Read what it tells you about a sample and what it leaves out.",
      cta: "Read the explanation",
    },
    {
      category: "The document library",
      title: "Looking for a particular report?",
      href: "/lab-results",
      detail:
        "Browse the supplier reports and any published batch documents by product.",
      cta: "Find a report",
    },
  ];
  return (
    <section
      id="journal"
      className="rb-section rb-journal"
      aria-labelledby="rb-journal-title"
    >
      <div className="rb-container">
        <div className="rb-section-heading">
          <div>
            <p className="rb-eyebrow">Before you order</p>
            <h2 id="rb-journal-title">A few things worth checking</h2>
          </div>
          <Link href="/lab-results" className="rb-text-link">
            View the report library <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="rb-journal-grid">
          {articles.map((article) => (
            <a
              key={article.href}
              href={article.href}
              className="rb-journal-card"
              onClick={() => {
                if (article.href.startsWith("#"))
                  document
                    .getElementById(article.href.slice(1))
                    ?.setAttribute("open", "");
              }}
            >
              <div className="rb-journal-copy">
                <p className="rb-eyebrow">{article.category}</p>
                <h3>{article.title}</h3>
                <p>{article.detail}</p>
                <span className="rb-text-link">
                  {article.cta} <ArrowUpRight size={16} />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ supportEmail }: { supportEmail: string }) {
  return (
    <section className="rb-section rb-faq" aria-labelledby="rb-faq-title">
      <div className="rb-container rb-faq-grid">
        <div>
          <p className="rb-eyebrow">Your questions</p>
          <h2 id="rb-faq-title">What would you like to know?</h2>
          <p>If your question isn’t covered here, send it to us.</p>
          <a href={`mailto:${supportEmail}`} className="rb-text-link">
            Email your question <ArrowUpRight size={16} />
          </a>
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
            <p className="rb-eyebrow">Contact East Coast Labs</p>
            <h2>Still have a question?</h2>
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
            <Link href="/shop">Research peptides</Link>
            <Link href="/lab-results">Laboratory reports</Link>
            <a href="#journal">Before you order</a>
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
        {variant === "v2" ? (
          <>
            <EvidenceSection {...props} />
            <CollectionSection {...props} />
          </>
        ) : (
          <>
            <CollectionSection {...props} />
            <EvidenceSection {...props} />
          </>
        )}
        <AboutSection variant={variant} supportEmail={props.supportEmail} />
        <Journal report={props.report} />
        <FaqSection supportEmail={props.supportEmail} />
      </main>
      <Footer {...props} />
      <CartDrawer />
      <StoreEnhancements exitIntent={false} />
    </div>
  );
}
