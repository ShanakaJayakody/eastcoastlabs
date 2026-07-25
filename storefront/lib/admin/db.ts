import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

/** Service-role client, or throw. Callers must already have passed requireAdmin()
 *  (or be a trusted server seam like checkout ingestion). */
export function adminDb(): SupabaseClient {
  const db = supabaseAdmin();
  if (!db) throw new Error("Supabase service-role client is not configured.");
  return db;
}
