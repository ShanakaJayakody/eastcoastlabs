const ITEMS = [
  { icon: "🔬", title: "Independent COA every batch", sub: "Tested by JanoShik before listing" },
  { icon: "✓", title: "≥98% purity verified", sub: "Every batch, every product" },
  { icon: "📦", title: "1-business-day dispatch", sub: "Ships from Australia" },
  { icon: "🤐", title: "Discreet packaging & billing", sub: "No product names on your statement" },
];

export default function TrustRow() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map((it) => (
        <div
          key={it.title}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface/60 p-3"
        >
          <span className="text-lg leading-none" aria-hidden>
            {it.icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">{it.title}</p>
            <p className="text-xs text-muted">{it.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
