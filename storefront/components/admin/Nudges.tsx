import Link from "next/link";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import type { Nudge } from "@/lib/admin/attention";

/**
 * Anomalies worth a sentence at the top of the dashboard.
 *
 * Each card states its own baseline, so the operator can judge whether the
 * observation deserves their attention rather than trusting a threshold they
 * cannot see. No nudges renders nothing at all — silence is the good state.
 */
export default function Nudges({ nudges }: { nudges: Nudge[] }) {
  if (nudges.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {nudges.map((nudge) => {
        const Icon = nudge.tone === "warn" ? AlertTriangle : Info;
        const tint =
          nudge.tone === "warn" ? "bg-warn/10 text-warn" : "bg-accent-2/10 text-accent-2";
        return (
          <Link
            key={nudge.id}
            href={nudge.href}
            className="admin-card admin-card-hover group flex gap-3 rounded-xl p-4"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-medium text-fg">
                {nudge.headline}
                <ArrowRight
                  size={13}
                  className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100"
                />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{nudge.detail}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
