/**
 * Legacy manual delivery diagnostic. Sends a real message directly via Resend
 * and records an outbox row; it does NOT exercise the leased production sender.
 * Only run against an explicitly authorised recipient. For visual review without
 * sending messages or touching the database, use `npm run preview:emails`.
 *
 * Usage (from storefront/):
 *   node --experimental-strip-types scripts/send-test-email.mjs <email> [template]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailShell, emailButton, EMAIL_STYLES } from "../lib/email/layout.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const line of (await readFile(path.join(here, "..", ".env.local"), "utf8")).split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const to = (process.argv[2] || "").trim().toLowerCase();
const template = process.argv[3] || "welcome_1";
if (!to.includes("@")) {
  console.error("✗ usage: node --experimental-strip-types scripts/send-test-email.mjs <email> [template]");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "East Coast Labs <orders@eastcoastlabs.com.au>";

// A unique related_id per run so the outbox dedupe index never swallows a repeat test.
const relatedId = `${to}:phase-c-test:${Date.now()}`;

const { data: row, error: queueError } = await db
  .from("email_outbox")
  .insert({
    to_email: to,
    template,
    payload: { test: true },
    related_type: "phase_c_test",
    related_id: relatedId,
  })
  .select("id")
  .single();
if (queueError) {
  console.error("✗ queue failed:", queueError.message);
  process.exit(1);
}
console.log(`→ queued outbox row ${row.id}`);

const subject = "East Coast Labs — delivery tracking test";
const html = emailShell({
  preheader: "East Coast Labs delivery tracking test",
  audience: "admin",
  body: `<h1 style="${EMAIL_STYLES.heading}">Delivery tracking test</h1>
    <p style="${EMAIL_STYLES.paragraph}">This is a one-off email delivery test. If tracking is enabled in Resend, opening this email or following the link below can record an event in the admin.</p>
    ${emailButton("https://www.eastcoastlabs.com.au/shop", "Check the website link")}`,
});

const { data: sent, error: sendError } = await resend.emails.send({ from: FROM, to, subject, html });
if (sendError) {
  await db.from("email_outbox").update({ status: "failed", error: sendError.message }).eq("id", row.id);
  console.error("✗ send failed:", sendError.message);
  process.exit(1);
}

await db
  .from("email_outbox")
  .update({
    status: "sent",
    sent_at: new Date().toISOString(),
    provider_message_id: sent?.id ?? null,
  })
  .eq("id", row.id);

console.log(`✓ sent to ${to}`);
console.log(`  outbox id:           ${row.id}`);
console.log(`  provider message id: ${sent?.id ?? "(none returned)"}`);
console.log(`  admin page:          /admin/customers/${encodeURIComponent(to)}`);
