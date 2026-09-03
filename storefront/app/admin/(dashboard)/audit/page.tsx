import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { listAudit, auditFacets } from "@/lib/admin/audit-log";
import { sydneyDayBoundary } from "@/lib/admin/order-queries";
import Badge from "@/components/admin/Badge";

export const metadata: Metadata = { title: "Audit log — ECL Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Where an audited entity actually lives, so a row is a way in, not a dead end. */
function entityHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "order") return `/admin/orders/${id}`;
  if (type === "customer") return `/admin/customers/${encodeURIComponent(id)}`;
  if (type === "product") return `/admin/products/${id}`;
  if (type === "discount") return "/admin/discounts";
  if (type === "coa") return "/admin/coas";
  if (type === "review") return "/admin/reviews";
  return null;
}

/** Compact render of the stored `{ before, after }` diff, when there is one. */
function diffSummary(diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const entries = Object.entries(diff as Record<string, unknown>).slice(0, 4);
  if (entries.length === 0) return null;
  return entries
    .map(([key, value]) => {
      const text =
        value == null
          ? "—"
          : typeof value === "object"
            ? JSON.stringify(value).slice(0, 60)
            : String(value).slice(0, 60);
      return `${key}: ${text}`;
    })
    .join(" · ");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const from = sydneyDayBoundary(sp.from) ? (sp.from as string) : "";
  const to = sydneyDayBoundary(sp.to, true) ? (sp.to as string) : "";
  const requestedPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const filters = {
    actor: sp.actor || undefined,
    action: sp.action || undefined,
    entityType: sp.entityType || undefined,
    entityId: sp.entityId || undefined,
    from,
    to,
  };

  // Count first so an out-of-range ?page= lands on the last real page instead
  // of an empty table sitting under a header that claims 120 entries.
  const counted = await listAudit({ ...filters, limit: 1, offset: 0 });
  const pages = Math.max(1, Math.ceil(counted.total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);

  const [{ rows, total }, facets] = await Promise.all([
    listAudit({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    auditFacets(),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    // Carry the *validated* dates, so a date the page rejected is not passed
    // along to every link as though it were filtering something.
    const merged = { ...sp, from, to, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (patch.page) params.set("page", patch.page);
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  const activeFilters = [
    sp.actor && { label: sp.actor, clear: href({ actor: undefined }) },
    sp.action && { label: sp.action, clear: href({ action: undefined }) },
    sp.entityType && {
      label: `${sp.entityType}${sp.entityId ? ` ${sp.entityId.slice(0, 12)}` : ""}`,
      clear: href({ entityType: undefined, entityId: undefined }),
    },
    (from || to) && {
      label: `${from || "start"} → ${to || "today"}`,
      clear: href({ from: undefined, to: undefined }),
    },
  ].filter(Boolean) as { label: string; clear: string }[];

  // An actor or action that has aged out of the 2000-row facet window would
  // otherwise be missing from its select, which silently drops the filter the
  // next time the form is submitted.
  const actorOptions = sp.actor && !facets.actors.includes(sp.actor)
    ? [sp.actor, ...facets.actors]
    : facets.actors;
  const actionOptions = sp.action && !facets.actions.includes(sp.action)
    ? [sp.action, ...facets.actions]
    : facets.actions;

  return (
    <div className="admin-stagger space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            {total} entr{total === 1 ? "y" : "ies"}
          </p>
          {activeFilters.map((f) => (
            <Link
              key={f.label}
              href={f.clear}
              title="Remove this filter"
              className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent hover:border-accent"
            >
              {f.label} ×
            </Link>
          ))}
        </div>
        <form action="/admin/audit" className="flex flex-wrap items-center gap-2">
          {/* The entity filter arrives by link, not by control — without these
              it would silently vanish the first time Filter is pressed. */}
          {sp.entityType && <input type="hidden" name="entityType" value={sp.entityType} />}
          {sp.entityId && <input type="hidden" name="entityId" value={sp.entityId} />}
          <select
            name="actor"
            defaultValue={sp.actor ?? ""}
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
          >
            <option value="">Anyone</option>
            {actorOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
          >
            <option value="">Any action</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a.endsWith(".") ? `${a}* (all)` : a}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="from"
            defaultValue={from}
            aria-label="From date"
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none [color-scheme:dark] focus:border-accent"
          />
          <input
            type="date"
            name="to"
            defaultValue={to}
            aria-label="To date"
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none [color-scheme:dark] focus:border-accent"
          />
          <button className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg">
            Filter
          </button>
          {activeFilters.length > 0 && (
            <Link
              href="/admin/audit"
              className="rounded-lg border border-line-2 px-3 py-1.5 text-sm text-muted hover:text-fg"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="admin-card overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">
            Nothing matches this view. Every admin action is recorded here as it happens.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Entity</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const link = entityHref(row.entity_type, row.entity_id);
                const detail = diffSummary(row.diff);
                return (
                  <tr key={row.id} className="transition hover:bg-surface-2/50">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(row.created_at).toLocaleString("en-AU")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href({ actor: row.actor_email, page: undefined })} className="text-fg-2 hover:text-accent">
                        {row.actor_email}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href({ action: row.action, page: undefined })}>
                        <Badge tone="info">{row.action}</Badge>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {row.entity_type ? (
                        link ? (
                          <Link href={link} className="font-mono text-xs text-accent-2 hover:underline">
                            {row.entity_type} · {(row.entity_id ?? "").slice(0, 12)}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {row.entity_type} · {(row.entity_id ?? "").slice(0, 12)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-2">—</span>
                      )}
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-muted lg:table-cell">
                      {detail ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: String(page - 1) })}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={href({ page: String(page + 1) })}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
