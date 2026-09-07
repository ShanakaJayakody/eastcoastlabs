import StampSeal from "./StampSeal";

const CLAUSES = [
  {
    title: "Find the certificate",
    body: "Available verified certificates appear on our Lab Results page.",
  },
  {
    title: "Check the batch",
    body: "Match the compound and batch identifier on the document to your product.",
  },
  {
    title: "Ask for missing evidence",
    body: "Contact support before ordering if the relevant certificate is unavailable.",
  },
];

/** 06 / left column — the guarantee, typeset as a signed contract sheet. */
export default function ContractPanel() {
  return (
    <div className="border border-line-2 bg-surface p-6 sm:p-8">
      <h2 className="font-serif-display text-2xl text-fg">Batch documentation</h2>
      <ol className="mt-6 space-y-5">
        {CLAUSES.map((c, i) => (
          <li key={c.title} className="flex gap-4">
            <span className="font-data pt-0.5 text-xs text-muted-2">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-sm font-semibold text-fg">{c.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <div className="font-data text-[11px] text-muted-2">
          <p>EAST COAST LABS</p>

        </div>
        <StampSeal size={48} className="rotate-[6deg] opacity-80" />
      </div>
    </div>
  );
}
