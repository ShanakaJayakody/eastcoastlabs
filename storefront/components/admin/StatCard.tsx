import type { LucideIcon } from "lucide-react";

/** Dashboard KPI tile. Real numbers arrive with the orders module (Phase B/C). */
export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        {Icon && <Icon size={16} className="text-muted-2" />}
      </div>
      <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
