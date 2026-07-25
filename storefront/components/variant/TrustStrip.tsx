/**
 * Four-pillar trust band — the Renue-style credibility row, but every claim here
 * is one East Coast Labs can actually substantiate (independent lab, published
 * COAs, AU dispatch, purity guarantee). Nothing aspirational, nothing invented.
 */
const PILLARS = [
  {
    icon: "🔬",
    title: "Independently tested",
    body: "Every batch analysed by JanoShik, an independent laboratory — never in-house.",
  },
  {
    icon: "📄",
    title: "COA published first",
    body: "Purity results go live on our Lab Results page before a product is listed for sale.",
  },
  {
    icon: "🇦🇺",
    title: "Australian owned",
    body: "Stocked and dispatched from Australia — orders ship within one business day.",
  },
  {
    icon: "🛡️",
    title: "Purity guarantee",
    body: "Test it yourself. Below our stated purity and we refund or replace — and cover the test.",
  },
];

export default function TrustStrip() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map((p) => (
        <div key={p.title} className="bg-surface p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-lg" aria-hidden>
            {p.icon}
          </span>
          <p className="mt-4 text-sm font-semibold text-fg">{p.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
        </div>
      ))}
    </div>
  );
}
