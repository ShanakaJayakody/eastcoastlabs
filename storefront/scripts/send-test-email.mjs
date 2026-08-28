/**
 * Send one real email through the production outbox path, to prove the Phase C
 * chain end-to-end: queue -> Resend -> provider_message_id recorded -> webhook
 * -> email_events -> journey chips.
 *
 * Deliberately goes through email_outbox + the Resend SDK exactly as the app
 * does, rather than calling Resend directly — a test that bypasses the seam it
 * is meant to prove tells you nothing.
 *
 * Usage (from storefront/):
 *   node scripts/send-test-email.mjs <email> [template]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const line of (await readFile(path.join(here, "..", ".env.local"), "utf8")).split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const to = (process.argv[2] || "").trim().toLowerCase();
const template = process.argv[3] || "welcome_1";
if (!to.includes("@")) {
  console.error("✗ usage: node scripts/send-test-email.mjs <email> [template]");
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
const html = `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 12px">Delivery tracking test</h2>
    <p style="color:#444;line-height:1.6">
      This message exists to prove the admin's email tracking works end to end.
      Opening it should register an <strong>opened</strong> event, and clicking the
      link below should register a <strong>clicked</strong> event — both visible on
      this address's page in the admin.
    </p>
    <p style="margin:24px 0">
      <a href="https://www.eastcoastlabs.com.au/shop"
         style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
        Click to register a click event
      </a>
    </p>
    <p style="color:#888;font-size:12px">Sent from the admin as a one-off test. Nothing is wrong.</p>
  </div>`;

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
