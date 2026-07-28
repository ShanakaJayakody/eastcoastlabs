import StampSeal from "./StampSeal";

const CLAUSES = [
  {
    title: "We test independently",
    body: "Every batch is analysed by JanoShik, an independent laboratory. We never test in-house, and we never grade our own work.",
  },
  {
    title: "We publish first",
    body: "The certificate of analysis goes live on our Lab Results page before the product is listed for sale — not after a complaint.",
  },
  {
    title: "We stand behind the number",
    body: "If any independent lab finds your batch below our stated purity, we refund or replace it — and we pay for the disputed test.",
  },
];

/** 06 / left column — the guarantee, typeset as a signed contract sheet. */
export default function ContractPanel() {
  return (
    <div className="border border-line-2 bg-surface p-6 sm:p-8">
      <h2 className="font-serif-display text-2xl text-fg">Our contract</h2>
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
          <p>ABN [PENDING]</p>
        </div>
        <StampSeal size={48} className="rotate-[6deg] opacity-80" />
      </div>
    </div>
  );
}
