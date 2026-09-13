"use server";

import { createSupabaseServerClient } from "@/lib/admin/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const adminCallbackUrl = () =>
  new URL(
    "/admin/auth/callback",
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.eastcoastlabs.com.au",
  ).toString();

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
    options: {
      emailRedirectTo: adminCallbackUrl(),
      shouldCreateUser: true,
    },
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

/** Complete the PKCE flow after the operator clicks the emailed magic link. */
export async function exchangeMagicLinkCode(code: string): Promise<ActionResult> {
  const clean = code.trim();
  if (!clean) return { ok: false, error: "The sign-in link is invalid or incomplete." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(clean);
  if (error) return { ok: false, error: error.message };

  const email = data.user?.email?.toLowerCase();
  if (email) await logAudit({ actor: email, action: "login" });
  return { ok: true };
}
