/**
 * Reading the audit trail.
 *
 * `audit.ts` writes; this module is the only read path. Every admin mutation
 * has been logging here since the admin was built, but until now the sole way
 * to see any of it was eight unfiltered rows on the dashboard — a record nobody
 * can query is not really a record.
 *
 * Two views, one query shape: the whole log with filters, and the trail for a
 * single entity to embed on its own detail page.
 */
import "server-only";
import { adminDb } from "./db";
import { sydneyDayBoundary } from "./order-queries";

export interface AuditRow {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  diff: unknown;
  created_at: string;
}

export interface AuditFilters {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  /** Inclusive Sydney date, `YYYY-MM-DD`. */
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  rows: AuditRow[];
  total: number;
}

export async function listAudit(filters: AuditFilters = {}): Promise<AuditPage> {
  const { limit = 50, offset = 0 } = filters;
  const { data, count, error } = await auditQuery(filters, limit, offset);
  if (error) {
    // PostgREST answers an offset past the end with 416 rather than an empty
    // page. A page number beyond the last one is a dead end, not a failure —
    // return the real total so the caller can send the operator somewhere sane.
    if (/range not satisfiable/i.test(error.message)) {
      const { count: total } = await auditQuery(filters, 1, 0);
      return { rows: [], total: total ?? 0 };
    }
    throw new Error(`listAudit: ${error.message}`);
  }
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

function auditQuery(filters: AuditFilters, limit: number, offset: number) {
  const { actor, action, entityType, entityId, from, to } = filters;

  let q = adminDb()
    .from("admin_audit_log")
    .select("id, actor_email, action, entity_type, entity_id, diff, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actor) q = q.eq("actor_email", actor);
  // Action is hierarchical ("order.status", "order.refund"), so a prefix filter
  // lets one choice mean "everything orders did".
  if (action) {
    // PostgREST maps `*` to `%` and passes `%`/`_` straight through, so an
    // unescaped value can widen a filter to match everything while the UI still
    // labels it as narrowed.
    q = action.endsWith(".")
      ? q.like("action", `${action.replace(/[%_*\\]/g, "\\$&")}%`)
      : q.eq("action", action);
  }
  if (entityType) q = q.eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", entityId);

  const fromIso = sydneyDayBoundary(from);
  const toIsoBound = sydneyDayBoundary(to, true);
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIsoBound) q = q.lt("created_at", toIsoBound);

  return q;
}

/** The trail for one entity, newest first — for embedding on a detail page. */
export async function auditTrailFor(
  entityType: string,
  entityId: string,
  limit = 20,
): Promise<AuditRow[]> {
  const { rows } = await listAudit({ entityType, entityId, limit });
  return rows;
}

/**
 * The distinct actors and action prefixes present in the log, for building
 * filter controls. Derived from the data rather than a hardcoded list, so a new
 * action type appears in the filter the first time it is ever logged.
 */
export async function auditFacets(): Promise<{ actors: string[]; actions: string[] }> {
  const { data } = await adminDb()
    .from("admin_audit_log")
    .select("actor_email, action")
    .order("created_at", { ascending: false })
    .limit(2000);

  const actors = new Set<string>();
  const actions = new Set<string>();
  for (const row of data ?? []) {
    actors.add(row.actor_email as string);
    const action = row.action as string;
    // Offer the group ("order.") as well as the exact action.
    const dot = action.indexOf(".");
    if (dot > 0) actions.add(`${action.slice(0, dot)}.`);
    actions.add(action);
  }
  return {
    actors: [...actors].sort(),
    actions: [...actions].sort(),
  };
}
