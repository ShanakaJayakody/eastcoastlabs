/**
 * Supabase clients.
 *
 * - `supabasePublic()` uses the public (publishable/anon) key — safe in the
 *   browser and for public reads (RLS-gated).
 * - `supabaseAdmin()` uses the service-role key — SERVER ONLY. Never import
 *   this into a client component; it bypasses RLS.
 *
 * Accessors return null when required variables are absent. Public pages may
 * render unavailable states; checkout and writes require configured services.
 * Missing certificates and catalogue entries never use historical fixtures.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/** Whether Supabase is configured for public reads. */
export function hasSupabase(): boolean {
  return Boolean(URL && ANON);
}

export function supabasePublic(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  if (!publicClient) {
    publicClient = createClient(URL, ANON, { auth: { persistSession: false } });
  }
  return publicClient;
}

/** Server-only admin client (bypasses RLS). Returns null if unconfigured. */
export function supabaseAdmin(): SupabaseClient | null {
  if (!URL || !SERVICE_ROLE) return null;
  if (!adminClient) {
    adminClient = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
  }
  return adminClient;
}
