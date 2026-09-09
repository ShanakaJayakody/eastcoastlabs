const ITEMS = [
  { icon: "🔬", title: "Batch documentation", sub: "Check available lab results" },
  { icon: "✓", title: "Research use only", sub: "Not for human consumption" },
  { icon: "📦", title: "Australian shipping", sub: "Dispatch after payment confirmation" },
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
