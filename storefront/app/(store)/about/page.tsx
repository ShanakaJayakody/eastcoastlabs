import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getAboutHtml } from "@/lib/content";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About",
  description:
    "East Coast Labs is an Australian-owned supplier of research-use-only peptides.",
};

export default async function AboutPage() {
  const [html, settings] = await Promise.all([getAboutHtml(), getSettings()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">About</p>
      </div>
      <article className="prose-ecl" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="mt-4 text-sm"><a className="text-accent" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p>
      <ResearchDisclaimer variant="badge" className="mt-10" />
    </div>
  );
}
