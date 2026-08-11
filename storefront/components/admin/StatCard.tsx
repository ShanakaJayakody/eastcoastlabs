import type { LucideIcon } from "lucide-react";

/** Dashboard KPI tile. `interactive` adds the hover-lift affordance for tiles
 *  that are wrapped in a Link — non-clickable tiles stay still. */
export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  interactive = false,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  interactive?: boolean;
  tone?: "default" | "accent" | "warn";
}) {
  const iconTone =
    tone === "accent"
      ? "bg-accent/10 text-accent"
      : tone === "warn"
        ? "bg-warn/10 text-warn"
        : "bg-surface-2 text-muted";

  return (
    <div
      className={`admin-card rounded-xl p-4 ${interactive ? "admin-card-hover cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-fg">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
