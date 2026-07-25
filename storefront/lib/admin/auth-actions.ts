"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import { logAudit } from "./audit";
import { getAdminSession } from "./auth";

/** Sign the current admin out and return to the login screen. */
export async function signOut(): Promise<void> {
  const session = await getAdminSession();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  if (session) await logAudit({ actor: session.email, action: "logout" });
  redirect("/admin/login");
}
