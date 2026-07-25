/**
 * Admin account management for /admin — no Supabase dashboard required.
 *
 * Admin access needs TWO things (see lib/admin/auth.ts):
 *   1. a row in public.admin_users with active = true   (the allow-list)
 *   2. a Supabase Auth session for that same email      (created by OTP sign-in)
 *
 * Usage (from storefront/):
 *   node scripts/admin.mjs list
 *   node scripts/admin.mjs add <email> [name]
 *   node scripts/admin.mjs disable <email>
 *   node scripts/admin.mjs code <email>     # 6-digit code WITHOUT waiting for email
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");

for (const line of (await readFile(envPath, "utf8")).split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

/**
 * GoTrue intermittently rejects a valid service-role key with
 * 403 bad_jwt ("unrecognized JWT kid <nil> for algorithm ES256") — a transient
 * signing-key blip, not a bad credential. Retry those; fail fast on everything else.
 */
async function api(pathname, init = {}, attempt = 1) {
  const res = await fetch(`${URL_BASE}${pathname}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const transient = res.status >= 500 || (res.status === 403 && text.includes("bad_jwt"));
    if (transient && attempt < 4) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return api(pathname, init, attempt + 1);
    }
    throw new Error(`${res.status} ${pathname}: ${text}`);
  }
  return body;
}

const [cmd, rawEmail, ...rest] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

function requireEmail() {
  if (!email?.includes("@")) {
    console.error("✗ Pass an email address.");
    process.exit(1);
  }
}

switch (cmd) {
  case "list": {
    const rows = await api("/rest/v1/admin_users?select=email,name,active,created_at&order=created_at");
    const { users } = await api("/auth/v1/admin/users?per_page=200");
    console.log("\nallow-list (public.admin_users):");
    for (const r of rows) {
      const signedIn = users.some((u) => u.email?.toLowerCase() === r.email);
      console.log(
        `  ${r.active ? "✓" : "✗"} ${r.email.padEnd(32)} ${(r.name ?? "").padEnd(16)} ` +
          `auth user: ${signedIn ? "yes" : "not yet — sign in once to create it"}`,
      );
    }
    if (!rows.length) console.log("  (empty — nobody can reach /admin)");
    console.log("");
    break;
  }

  case "add": {
    requireEmail();
    const name = rest.join(" ") || null;
    await api("/rest/v1/admin_users", {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ email, name, active: true }),
    });
    console.log(`✓ ${email} allow-listed. They can now sign in at /admin/login.`);
    break;
  }

  case "disable": {
    requireEmail();
    await api(`/rest/v1/admin_users?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    console.log(`✓ ${email} deactivated — /admin now returns 403 for them.`);
    break;
  }

  case "code": {
    requireEmail();
    // generate_link creates the auth user if needed and returns the OTP WITHOUT
    // sending an email — the escape hatch when SMTP isn't configured yet.
    const out = await api("/auth/v1/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", email }),
    });
    console.log(`\n  Sign-in code for ${email}:  ${out.email_otp}\n`);
    console.log("  At /admin/login: enter the email, then click \"I already have a code\".");
    console.log("  Do NOT click \"Send code\" — every send rotates the OTP and voids this one.");
    console.log("  (Valid ~1 hour, single use.)\n");
    break;
  }

  default:
    console.log("Usage: node scripts/admin.mjs list | add <email> [name] | disable <email> | code <email>");
}
