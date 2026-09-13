import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getAboutHtml } from "@/lib/content";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About",
  description:
    "East Coast Labs is an Australian-owned supplier of research-use-only peptides.",
};

export default async function AboutPage() {
  const [html, settings] = await Promise.all([getAboutHtml(), getSettings()]);

  return (
    <div className="ecl-about-page">
      <section className="ecl-about-hero">
        <Image
          src="/images/editorial/coastal-study.webp"
          alt="Coastal surf and rock formations"
          fill
          unoptimized
          priority
          sizes="100vw"
        />
        <div className="ecl-container">
          <p className="ecl-eyebrow">EAST COAST LABS / AUSTRALIA</p>
          <h1>
            Grounded in curiosity.
            <br />
            <em>Guided by clarity.</em>
          </h1>
          <p>An Australian-owned supplier of research-use-only peptides.</p>
        </div>
      </section>
      <div className="ecl-container ecl-about-body">
        <aside>
          <p className="ecl-eyebrow">THE PEOPLE BEHIND THE COMPOUNDS</p>
          <h2>East Coast Labs</h2>
          <p>
            Research materials. Clear information. A local team to help with the
            details.
          </p>
          <Link href="/shop" className="ecl-text-link">
            Explore our collection <ArrowUpRight size={17} />
          </Link>
        </aside>
        <div>
          <article
            className="prose-ecl"
            dangerouslySetInnerHTML={{
              __html: html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, ""),
            }}
          />
          <p className="mt-4 text-sm">
            <a className="text-accent" href={`mailto:${settings.supportEmail}`}>
              {settings.supportEmail}
            </a>
          </p>
          <ResearchDisclaimer variant="badge" className="mt-10" />
        </div>
      </div>
    </div>
  );
}
