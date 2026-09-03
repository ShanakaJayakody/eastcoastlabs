import Link from "next/link";
import { auditTrailFor } from "@/lib/admin/audit-log";
import Badge from "./Badge";

/**
 * The audit trail for one entity, rendered inline on its detail page.
 *
 * Every mutation in the admin has always been logged; this is the first surface
 * that shows it next to the thing it happened to, which is where the question
 * "who changed this, and when?" is actually asked.
 */
export default async function AuditTrail({
  entityType,
  entityId,
  limit = 8,
}: {
  entityType: string;
  entityId: string;
  limit?: number;
}) {
  const rows = await auditTrailFor(entityType, entityId, limit);
  if (rows.length === 0) return null;

  const moreHref = `/admin/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;

  return (
    <section className="admin-card rounded-xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Audit trail</h3>
        <Link href={moreHref} className="text-xs text-accent-2 hover:underline">
          Full history
        </Link>
      </div>
      <div className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Badge tone="info">{row.action}</Badge>
              <span className="truncate text-fg-2">{row.actor_email}</span>
            </div>
            <span className="shrink-0 text-xs text-muted">
              {new Date(row.created_at).toLocaleString("en-AU")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
