"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
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
  { href: "#collection", label: "Our collection" },
  { href: "#standards", label: "Testing & transparency" },
  { href: "#journal", label: "The reading room" },
];

function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="rb-wordmark" aria-label="East Coast Labs home">
      <span>
        east coast<span className="rb-wordmark-dot">.</span>
      </span>
      <small>LABS · AUSTRALIA</small>
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
        <span>Australian owned. Thoughtfully considered.</span>
        <Link href="/lab-results">
          Original laboratory reports, open to explore{" "}
          <ArrowUpRight size={12} />
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
              Explore peptides <ArrowUpRight size={15} />
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
              Explore all peptides <ArrowUpRight size={18} />
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
}: Pick<RebrandProps, "variant" | "reportCount">) {
  const copy = directions[variant];
  const science = variant === "v2";
  return (
    <section
      className={`rb-hero rb-hero-${variant}`}
      aria-labelledby="rb-hero-title"
    >
      <div className="rb-container rb-hero-grid">
        <div className="rb-hero-copy">
          <p className="rb-eyebrow">
            <span className="rb-small-rule" />
            {copy.eyebrow}
          </p>
          <h1 id="rb-hero-title">
            {copy.heading}
            <br />
            <em>{copy.emphasis}</em>
          </h1>
          <p className="rb-intro">{copy.intro}</p>
          <div className="rb-actions">
            <Link
              href={science ? "/lab-results" : "#collection"}
              className="rb-button rb-button-primary"
            >
              {copy.primary}
              <ArrowUpRight size={18} />
            </Link>
            <Link
              href={science ? "#collection" : "#standards"}
              className="rb-text-link"
            >
              {copy.secondary}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rb-hero-notes">
            <span>
              <Check size={14} /> Original source documents
            </span>
            <span>
              <Check size={14} /> Australian support
            </span>
          </div>
          <p className="rb-research-note">
            For laboratory research only. Not for human or animal consumption.
          </p>
        </div>
        {variant === "v1" && (
          <div className="rb-hero-portrait">
            <Image
              unoptimized
              src="/images/rebrand/coastal-women.webp"
              alt="Editorial brand image of two women at different stages of life on an Australian coastal path"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 50vw"
            />
            <div className="rb-photo-label">
              <span className="rb-label-icon">
                <FileCheck2 size={23} strokeWidth={1.3} />
              </span>
              <span>
                Confidence in the details.
                <small>Clear information. Open documentation.</small>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <span className="rb-photo-register">
              A THOUGHTFUL WAY FORWARD / ECL
            </span>
          </div>
        )}
        {science && (
          <div className="rb-science-art">
            <div className="rb-science-art-top">
              <span>THE RESEARCH COLLECTION</span>
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
            <div className="rb-science-caption">
              <span>
                RESEARCH MATERIALS<span>Clarity, from the outset.</span>
              </span>
              <span>01—05</span>
            </div>
            <Link href="/lab-results" className="rb-science-proof">
              <FileCheck2 size={25} strokeWidth={1.4} />
              <span>
                <strong>{reportCount} original supplier reports</strong>
                <small>View samples, dates & source documents</small>
              </span>
              <ArrowUpRight size={20} />
            </Link>
          </div>
        )}
      </div>
      {variant === "v3" && (
        <div className="rb-container rb-editorial-panels">
          <figure>
            <div className="rb-editorial-image">
              <Image
                unoptimized
                src="/images/rebrand/coastal-women.webp"
                alt="Editorial portrait of two women beside the coast"
                fill
                priority
                sizes="(max-width: 600px) 100vw, 40vw"
              />
            </div>
            <figcaption>
              <span>A HUMAN PERSPECTIVE</span>
              <span>01</span>
            </figcaption>
          </figure>
          <figure>
            <div className="rb-editorial-image">
              <Image
                unoptimized
                src="/images/rebrand/research-collection.webp"
                alt="The East Coast Labs research collection"
                fill
                priority
                sizes="(max-width: 600px) 100vw, 35vw"
              />
            </div>
            <figcaption>
              <span>A CONSIDERED COLLECTION</span>
              <span>02</span>
            </figcaption>
          </figure>
          <figure>
            <div className="rb-editorial-image">
              <Image
                unoptimized
                src="/images/editorial/coastal-study.webp"
                alt="Waves meeting the Australian coastline"
                fill
                sizes="(max-width: 600px) 50vw, 25vw"
              />
            </div>
            <figcaption>
              <span>GROUNDED IN AUSTRALIA</span>
              <span>03</span>
            </figcaption>
          </figure>
        </div>
      )}
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
            Evidence you can explore<small>Original lab reports, in full</small>
          </span>
          <ArrowUpRight size={16} />
        </Link>
        <a href="#standards">
          <FlaskConical size={24} strokeWidth={1.3} />
          <span>
            Details that matter<small>Sample, method and batch context</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
        <a href="#contact">
          <MessageCircle size={24} strokeWidth={1.3} />
          <span>
            A local point of contact
            <small>An Australian team, here to help</small>
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
            <p className="rb-eyebrow">THE RESEARCH COLLECTION</p>
            <h2 id="rb-collection-title">{directions[variant].rangeTitle}</h2>
          </div>
          <Link href="/shop" className="rb-text-link">
            View all peptides <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="rb-section-description">
          Explore by research area. Find current sizes, availability and pricing
          on each product page.
        </p>
        <div className="rb-filters" aria-label="Filter by research area">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Featured research
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
                ? "More to explore in the full collection."
                : "The collection is being updated."}
            </h3>
            <p>
              Contact our team for current product availability, or explore the
              full catalogue.
            </p>
            <Link href="/shop" className="rb-text-link">
              Open the catalogue <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="rb-range-note">
          <span>Laboratory research materials</span>
          <span>Clear product information. Considered choices.</span>
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
          <p className="rb-eyebrow">OUR APPROACH TO TRANSPARENCY</p>
          <h2 id="rb-evidence-title">{directions[variant].proofTitle}</h2>
          <p className="rb-section-description">
            Trust should be something you can look into. That is why we make
            original laboratory documentation accessible, with the context to
            read it properly.
          </p>
          <ol className="rb-standards-list">
            <li>
              <span>01</span>
              <div>
                <h3>Start with the source.</h3>
                <p>
                  Read original Janoshik supplier reports and review the
                  laboratory&apos;s verification page.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Look closely at the sample.</h3>
                <p>
                  Check what was tested, when it was tested, and the
                  measurements recorded in that report.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Ask about the current batch.</h3>
                <p>
                  Historical results relate to their tested samples. Confirm
                  current batch applicability with our team.
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
              <span>OPEN DOCUMENTATION</span>
              <FileText size={21} strokeWidth={1.3} />
            </div>
            <div className="rb-report-heading">
              <h3>The detail is the difference.</h3>
              <p>An original from our supplier report library.</p>
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
                <dd>{report.testDate}</dd>
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
              Verify at Janoshik <ArrowUpRight size={17} />
            </a>
            <p className="rb-report-footnote">
              Historical supplier report. Sample-specific results; not proof of
              current inventory or suitability for personal use.
            </p>
          </div>
          <div className="rb-report-caption">
            <FileCheck2 size={18} />
            <span>{reportCount} original reports. Available to read.</span>
          </div>
        </div>
        {records.length > 0 && (
          <div className="rb-current-docs">
            <h3>Published batch documents</h3>
            <p>
              Read each document and confirm it applies to the batch you need.
            </p>
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
                    Batch {record.batch_id} · {record.test_date}
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

function AboutSection({ variant }: { variant: RebrandVariant }) {
  return (
    <section id="about" className="rb-about" aria-labelledby="rb-about-title">
      <div className="rb-about-image">
        <Image
          unoptimized
          src={
            variant === "v3"
              ? "/images/rebrand/coastal-women.webp"
              : "/images/editorial/coastal-study.webp"
          }
          alt={
            variant === "v3"
              ? "Editorial brand portrait of two women beside the Australian coast"
              : "Ocean surf along a quiet Australian coastline"
          }
          fill
          sizes="(max-width: 800px) 100vw, 50vw"
        />
        <span>EAST COAST ROOTS. AN OPEN OUTLOOK.</span>
      </div>
      <div className="rb-about-copy">
        <p className="rb-eyebrow">SCIENCE, WITH A HUMAN PERSPECTIVE</p>
        <h2 id="rb-about-title">{directions[variant].aboutTitle}</h2>
        <p>{directions[variant].aboutCopy}</p>
        <p>
          East Coast Labs is an Australian-owned research supplier. We bring
          together open documentation, straightforward product information and a
          team you can reach.
        </p>
        <Link href="/about" className="rb-text-link">
          Get to know East Coast Labs <ArrowUpRight size={17} />
        </Link>
        <div className="rb-purpose-note">
          Our products are for laboratory research only. For personal health
          decisions, speak with a qualified healthcare professional.
        </div>
      </div>
    </section>
  );
}

function Journal({ report }: { report: LabReport }) {
  const articles = [
    {
      number: "01",
      category: "UNDERSTANDING THE EVIDENCE",
      title: "Start with the original document.",
      href: report.image,
      detail:
        "Read a historical supplier report, including the sample and test date.",
      cta: "Open a sample report",
      icon: FileText,
    },
    {
      number: "02",
      category: "A CLOSER LOOK AT TESTING",
      title: "What can a purity result tell you?",
      href: "#rb-question-1",
      detail:
        "Understand the scope of a sample result, and the questions it cannot answer.",
      cta: "Read the explanation",
      icon: FlaskConical,
    },
    {
      number: "03",
      category: "BUILDING YOUR UNDERSTANDING",
      title: "See the evidence in context.",
      href: "/lab-results",
      detail:
        "Explore original supplier reports and available published batch documents.",
      cta: "Explore the library",
      icon: FileCheck2,
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
            <p className="rb-eyebrow">THE READING ROOM</p>
            <h2 id="rb-journal-title">Good questions are a good start.</h2>
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
              <div className="rb-journal-art">
                <article.icon size={48} strokeWidth={0.85} />
                <span>{article.number}</span>
              </div>
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
          <p className="rb-eyebrow">HERE TO MAKE THINGS CLEARER</p>
          <h2 id="rb-faq-title">
            A little more
            <br />
            <em>understanding.</em>
          </h2>
          <p>Questions are always welcome.</p>
          <a href={`mailto:${supportEmail}`} className="rb-text-link">
            Talk to our team <ArrowUpRight size={16} />
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
            <p className="rb-eyebrow">A LOCAL TEAM. AN OPEN CONVERSATION.</p>
            <h2>Let&apos;s make things clearer.</h2>
          </div>
          <a
            href={`mailto:${supportEmail}`}
            className="rb-button rb-button-light"
          >
            Get in touch <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="rb-footer-grid">
          <div>
            <Wordmark href={`/${variant.slice(1)}`} />
            <p>
              Research, thoughtfully considered.
              <br />
              From the Australian east coast.
            </p>
            <span className="rb-location">
              <MapPin size={14} /> Australian owned
            </span>
          </div>
          <nav aria-label="Footer collection links">
            <h3>Explore</h3>
            <Link href="/shop">Research peptides</Link>
            <Link href="/lab-results">Laboratory reports</Link>
            <a href="#journal">The reading room</a>
            <Link href="/about">Our story</Link>
          </nav>
          <nav aria-label="Customer information">
            <h3>Good to know</h3>
            <Link href="/shipping">Shipping & delivery</Link>
            <Link href="/returns">Returns policy</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms & conditions</Link>
          </nav>
          <div>
            <h3>Here to help</h3>
            <a className="rb-support-email" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            {supportHours && <p>{supportHours}</p>}
            <p>
              Product questions.
              <br />
              Document questions.
              <br />A real conversation.
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
        <Hero variant={variant} reportCount={props.reportCount} />
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
        <AboutSection variant={variant} />
        <Journal report={props.report} />
        <FaqSection supportEmail={props.supportEmail} />
      </main>
      <Footer {...props} />
      <CartDrawer />
      <StoreEnhancements exitIntent={false} />
    </div>
  );
}
