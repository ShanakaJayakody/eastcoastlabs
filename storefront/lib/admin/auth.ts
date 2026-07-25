/**
 * The authoritative admin gate. Two independent checks, never one:
 *   1. A valid Supabase Auth session (who are you?)  — anon-key cookie client.
 *   2. That identity is an active row in admin_users  — service-role client.
 *
 * Only after BOTH pass does any admin code touch the service-role key. This is
 * the real security boundary; the middleware is just UX around it.
 */
import { redirect, forbidden } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export interface AdminSession {
  email: string;
  userId: string;
}

/** Returns the admin session, or null if not signed in / not allow-listed. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = supabaseAdmin();
  if (!admin) return null;

  const { data } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (!data) return null;
  return { email: user.email.toLowerCase(), userId: user.id };
}

/**
 * Enforce admin access. No session → redirect to login (ISC-1). Signed in but
 * not on the allow-list → real 403 (ISC-3). Returns the session when allowed.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/admin/login");

  const admin = supabaseAdmin();
  if (!admin) redirect("/admin/login");

  const { data } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (!data) forbidden();
  return { email: user.email.toLowerCase(), userId: user.id };
}
