import type { Metadata } from "next";
import Link from "next/link";
import ReconstitutionCalculator from "@/components/ReconstitutionCalculator";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Research Hub — Reconstitution, Storage & Handling",
  description:
    "Lab-handling references for research peptides: reconstitution, storage, and how independent purity testing works. Research use only.",
};

const GUIDES = [
  {
    title: "Reconstitution",
    icon: "🧪",
    points: [
      "Bring the vial and diluent to room temperature before you start.",
      "Add bacteriostatic water slowly down the vial wall — don't spray directly onto the powder.",
      "Swirl gently; never shake. Let it dissolve fully before use.",
      "Use the calculator below to record the resulting concentration.",
    ],
  },
  {
    title: "Storage & handling",
    icon: "❄️",
    points: [
      "Lyophilised (unreconstituted) vials: store cool, dry, and away from light.",
      "Once reconstituted: refrigerate and keep sealed between uses.",
      "Use sterile, aseptic technique throughout.",
      "Keep the batch number with your records for COA lookup.",
    ],
  },
  {
    title: "How testing works",
    icon: "🔬",
    points: [
      "Every batch is sent to JanoShik, an independent laboratory.",
      "Purity is measured by HPLC and identity confirmed before listing.",
      "The Certificate of Analysis is published before the batch is sold.",
      "Verify any vial by its batch number on the Lab Results page.",
    ],
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Research hub</p>
        <h1 className="mt-2 text-3xl font-bold text-fg sm:text-4xl">
          Handling references for your research
        </h1>
        <p className="mt-3 text-muted">
          Practical lab-handling guidance for reconstitution, storage, and verifying purity. For
          research use only — we don&apos;t provide dosing or administration guidance.
        </p>
        <ResearchDisclaimer className="mt-5" />
      </div>

      <Reveal className="stagger mt-10 grid gap-4 sm:grid-cols-3">
        {GUIDES.map((g) => (
          <div key={g.title} className="card-hover rounded-2xl border border-line bg-surface p-5 hover:border-accent/40">
            <span className="text-2xl" aria-hidden>{g.icon}</span>
            <h2 className="mt-2 text-base font-semibold text-fg">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {g.points.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-accent">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Reveal>

      <div className="mt-10">
        <ReconstitutionCalculator />
      </div>

      <div className="mt-12 rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-6 text-center">
        <p className="text-sm text-muted">Ready to verify a batch you already have?</p>
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
