/**
 * Append-only audit trail. Every admin mutation should call logAudit so the
 * business has a "who did what, when, and what changed" record WooCommerce never
 * gave them. Writes go through the service-role client (bypasses RLS); callers
 * must already have passed requireAdmin().
 */
import { supabaseAdmin } from "@/lib/supabase";

export interface AuditEntry {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  diff?: unknown;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const admin = supabaseAdmin();
  if (!admin) return;
  await admin.from("admin_audit_log").insert({
    actor_email: entry.actor,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
  });
}
