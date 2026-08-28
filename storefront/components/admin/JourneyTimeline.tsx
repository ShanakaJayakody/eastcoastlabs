import type { ReactNode } from "react";
import { BellRing, Mail, ShoppingCart, UserCog } from "lucide-react";
import Badge, { type BadgeTone } from "./Badge";

export interface JourneyItem {
  id: string;
  at: string;
  kind: "email" | "order" | "subscription" | "admin";
  title: string;
  detail?: string | null;
  status?: "queued" | "sent" | "failed" | "cancelled" | null;
  group?: string | null;
  action?: ReactNode;
}

const ICONS = {
  email: Mail,
  order: ShoppingCart,
  subscription: BellRing,
  admin: UserCog,
} as const;

const NODE_TINT: Record<JourneyItem["kind"], string> = {
  email: "bg-accent-2/10 text-accent-2 border-accent-2/30",
  order: "bg-accent/10 text-accent border-accent/30",
  subscription: "bg-muted/10 text-muted border-line-2",
  admin: "bg-warn/10 text-warn border-warn/30",
};

const STATUS_TONE: Record<NonNullable<JourneyItem["status"]>, BadgeTone> = {
  queued: "neutral",
  sent: "success",
  failed: "danger",
  cancelled: "warn",
};

function relativePast(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 0) return "scheduled";
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Day bucket label — recent days read better as words than as dates. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/** Vertical activity timeline. Items arrive newest-first and are never re-sorted here. */
export default function JourneyTimeline({
  items,
  emptyMessage = "Nothing yet.",
}: {
  items: JourneyItem[];
  emptyMessage?: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  // Preserve incoming order while collapsing consecutive same-day runs into one header.
  const groups: { label: string; items: JourneyItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="relative">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="sticky top-0 z-10 bg-ink/90 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-2 backdrop-blur-sm">
            {group.label}
          </div>

          {group.items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <div key={item.id} className="relative flex gap-3 pb-4 pl-1">
                {/* Rail runs behind the nodes; the node's own background masks it. */}
                <span
                  className="absolute bottom-0 left-[15px] top-0 w-px bg-line"
                  aria-hidden
                />
                <span
                  className={`relative z-[1] mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border ${NODE_TINT[item.kind]}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>

                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg-2">{item.title}</span>
                      {item.group && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-2">
                          {item.group}
                        </span>
                      )}
                      {item.status && (
                        <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                      )}
                    </div>
                    {item.detail && (
                      <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                    )}
                  </div>

                  <div className="flex flex-none flex-col items-end gap-1 text-right">
                    <span className="text-[11px] text-muted-2">
                      {new Date(item.at).toLocaleString("en-AU")}
                    </span>
                    <span className="text-[11px] text-muted">{relativePast(item.at)}</span>
                    {item.action && <div className="mt-1">{item.action}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
