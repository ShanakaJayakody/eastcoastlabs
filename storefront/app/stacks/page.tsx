import type { Metadata } from "next";
import { getStacks } from "@/lib/stacks";
import StackCard from "@/components/StackCard";
import TrustRow from "@/components/TrustRow";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Research Stacks",
  description:
    "Curated peptide stacks — the compounds most commonly researched together, priced below single vials. Every batch independently tested.",
};

export default async function StacksPage() {
  const stacks = await getStacks();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Research stacks</p>
        <h1 className="mt-2 text-3xl font-bold text-fg sm:text-4xl">
          The combinations researchers reach for — priced as a set
        </h1>
        <p className="mt-3 text-muted">
          Each stack groups peptides that are studied together and prices them below the cost of
          the single vials. Same independent testing, same 1-business-day dispatch, one shipment.
        </p>
        <ResearchDisclaimer className="mt-5" />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {stacks.map((stack) => (
          <StackCard key={stack.slug} stack={stack} />
        ))}
      </div>

      <div className="mt-14">
        <TrustRow />
      </div>
    </div>
  );
}
