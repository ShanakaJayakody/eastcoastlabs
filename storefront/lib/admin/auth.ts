/**
 * The authoritative admin gate. Two independent checks, never one:
 *   1. A valid Supabase Auth session (who are you?)  — anon-key cookie client.
 *   2. That identity is an active row in admin_users  — service-role client.
 *
 * Only after BOTH pass does any admin code touch the service-role key. This is
 * the real security boundary; the middleware is just UX around it.
 */
import { cache } from "react";
import { redirect, forbidden } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export interface AdminSession {
  email: string;
  userId: string;
}

/**
 * Resolve the caller once per request.
 *
 * The dashboard layout AND every page call requireAdmin(), and each call used
 * to make two network round trips (Supabase Auth getUser + the admin_users
 * lookup). React's `cache()` dedupes them for the lifetime of a single render,
 * so a page load pays for the auth check once instead of 2–3 times — a large
 * win given the database is a network hop away.
 */
const resolveSession = cache(async (): Promise<AdminSession | "anon" | "forbidden"> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return "anon";

  const admin = supabaseAdmin();
  if (!admin) return "anon";

  const email = user.email.toLowerCase();
  const { data } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (!data) return "forbidden";
  return { email, userId: user.id };
});

/** Returns the admin session, or null if not signed in / not allow-listed. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await resolveSession();
  return typeof result === "string" ? null : result;
}

/**
 * Enforce admin access. No session → redirect to login (ISC-1). Signed in but
 * not on the allow-list → real 403 (ISC-3). Returns the session when allowed.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const result = await resolveSession();
  if (result === "anon") redirect("/admin/login");
  if (result === "forbidden") forbidden();
  return result;
}
