import type { Metadata } from "next";
import { getAboutHtml } from "@/lib/content";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";

export const metadata: Metadata = {
  title: "About",
  description:
    "East Coast Labs is an Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik.",
};

export default async function AboutPage() {
  const html = await getAboutHtml();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">About</p>
        <p className="mt-2 text-sm text-muted">ABN: [PENDING]</p>
      </div>
      <article className="prose-ecl" dangerouslySetInnerHTML={{ __html: html }} />
      <ResearchDisclaimer variant="badge" className="mt-10" />
    </div>
  );
}
