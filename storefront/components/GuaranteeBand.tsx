/**
 * Homepage purity-guarantee band. The single strongest trust lever for a
 * research-peptide vendor: a specific, falsifiable promise ("test it yourself —
 * we cover the test") rather than a vague quality claim.
 */
export default function GuaranteeBand() {
  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-8 sm:p-10">
      <div className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center sm:gap-8">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-3xl">
          🛡️
        </div>
        <div>
          <h2 className="text-xl font-semibold text-fg">The purity guarantee</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every batch is independently tested by JanoShik and the COA is published{" "}
            <span className="text-fg-2">before</span> the product is listed. Don&apos;t take our word
            for it — send any vial for third-party testing. If it comes back below our stated purity
            guarantee, we refund or replace it{" "}
            <span className="text-fg-2">and cover the cost of the test</span>.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-fg-2">
            <span className="flex items-center gap-1.5"><span className="text-accent">✓</span> Independent lab, every batch</span>
            <span className="flex items-center gap-1.5"><span className="text-accent">✓</span> COA published before listing</span>
            <span className="flex items-center gap-1.5"><span className="text-accent">✓</span> Refund or replace, no quibble</span>
          </div>
        </div>
      </div>
    </div>
  );
}
