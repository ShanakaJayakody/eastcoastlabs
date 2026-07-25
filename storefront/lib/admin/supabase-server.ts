/**
 * Supabase client bound to the Next.js request cookies. Used to READ the current
 * admin's auth session (server components, middleware, server actions). This is
 * the anon/publishable key — it only ever tells us *who* is signed in. Authority
 * over data comes later, via the service-role client, and only after the
 * allow-list check in lib/admin/auth.ts.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  if (!URL || !ANON) {
    throw new Error("Supabase public env vars are not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a Server Component render, cookies() is read-only and this throws;
        // that's expected — the middleware refreshes the session cookie instead.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* no-op: session refresh handled by middleware */
        }
      },
    },
  });
}
