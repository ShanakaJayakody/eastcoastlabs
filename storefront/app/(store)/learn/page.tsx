import type { Metadata } from "next";
import Link from "next/link";
import { getGuides } from "@/lib/guides";
import ReconstitutionCalculator from "@/components/ReconstitutionCalculator";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import Reveal from "@/components/Reveal";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Research Hub — Peptide Guides, Reconstitution & Purity Testing",
  description:
    "Research-focused guides on peptide reconstitution, storage, purity testing and reading a Certificate of Analysis, plus per-compound overviews. Research use only.",
};

const CATEGORY_LABELS: Record<string, string> = {
  Fundamentals: "Fundamentals",
  Compound: "Compound overviews",
};

export default async function LearnPage() {
  const guides = await getGuides();
  const groups = guides.reduce<Record<string, typeof guides>>((acc, g) => {
    (acc[g.category] ??= []).push(g);
    return acc;
  }, {});
  const order = ["Fundamentals", "Compound"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Research hub</p>
        <h1 className="mt-2 text-3xl font-bold text-fg sm:text-4xl">
          Peptide research guides
        </h1>
        <p className="mt-3 text-muted">
          Practical, research-focused references — how to reconstitute, store and verify peptides,
          how purity testing works, and per-compound overviews. For laboratory research use only; we
          don&apos;t provide dosing or administration guidance.
        </p>
        <ResearchDisclaimer className="mt-5" />
      </div>

      {order.map((cat) =>
        groups[cat]?.length ? (
          <section key={cat} className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <Reveal className="stagger mt-4 grid gap-4 sm:grid-cols-2">
              {groups[cat].map((g) => (
                <Link
                  key={g.slug}
                  href={`/learn/${g.slug}`}
                  className="card-hover flex flex-col rounded-2xl border border-line bg-surface p-5 hover:border-accent/40"
                >
                  <h3 className="text-base font-semibold text-fg">{g.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted">{g.description}</p>
                  <span className="mt-3 text-xs text-muted-2">{g.readMins} min read →</span>
                </Link>
              ))}
            </Reveal>
          </section>
        ) : null,
      )}

      {/* Reconstitution calculator */}
      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-2">Tools</h2>
        <ReconstitutionCalculator />
      </section>

      <div className="mt-12 rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-6 text-center">
        <p className="text-sm text-muted">Already have a vial? Confirm its batch is genuine.</p>
        <Link
          href="/lab-results"
          className="btn-press mt-3 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-95"
        >
          Verify a batch number →
        </Link>
      </div>
    </div>
  );
}
