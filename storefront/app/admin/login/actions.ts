"use server";

import { createSupabaseServerClient } from "@/lib/admin/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function isAllowListed(email: string): Promise<boolean> {
  const admin = supabaseAdmin();
  if (!admin) return false;
  const { data } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  return Boolean(data);
}

/** Step 1: email → send a one-time code (only to allow-listed operators). */
export async function sendOtp(email: string): Promise<ActionResult> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!(await isAllowListed(clean))) {
    return { ok: false, error: "This email is not authorised for admin access." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Step 2: email + 6-digit code → establish the session. */
export async function verifyOtp(email: string, token: string): Promise<ActionResult> {
  const clean = email.trim().toLowerCase();
  const code = token.trim();
  // Emailed OTPs are 6 digits; codes minted via the admin generate_link escape
  // hatch (scripts/admin.mjs code) are 8. Accept either.
  if (!/^\d{6,8}$/.test(code)) {
    return { ok: false, error: "Enter the code from your email." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: clean,
    token: code,
    type: "email",
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actor: clean, action: "login" });
  return { ok: true };
}
