import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;

const input = {
  name: "Taylor Example",
  email: "taylor@example.test",
  social_url: "https://instagram.com/taylor.example/",
  portfolio_url: "",
  discipline: "video",
  focus: "health",
  region: "VIC",
  pitch: "I create practical health stories with polished vertical video and clear product framing.",
  audience: "",
  adult_australia: true,
  contact_consent: true,
  privacy_version: "creator-privacy-2026-09-09",
};

const rpc = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await db.query<{ r: T }>(`select ${sql} r`, args)).rows[0].r;

async function createApplication() {
  await rpc("creator_submit_application($1::jsonb,$2::uuid,$3,$4,$5)", [
    JSON.stringify(input),
    "30000000-0000-0000-0000-000000000001",
    "a".repeat(64),
    "b".repeat(64),
    "c".repeat(64),
  ]);
  return (await db.query<{ id: string }>("select id from creator_applications")).rows[0].id;
}

const review = (id: string, revision: number, status: string, notes = "Notes") =>
  rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
    id,
    revision,
    status,
    notes,
    "operator@example.test",
  ]);

describe("creator admin SQL review workflow", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role service_role bypassrls; create role anon; create role authenticated;");
    await db.exec(
      "create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text not null,action text not null,entity_type text,entity_id text,diff jsonb,created_at timestamptz not null default now());",
    );
    await db.exec(readFileSync(resolve("supabase/migrations/20260909140000_creator_applications.sql"), "utf8"));
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(
      "truncate creator_application_requests cascade; truncate creator_applications cascade; truncate creator_application_limits cascade; truncate admin_audit_log cascade;",
    );
  });

  it("increments revision for note-only edits and records compact audit metadata", async () => {
    const id = await createApplication();
    await expect(review(id, 0, "new", "Private reviewer notes only.")).resolves.toMatchObject({
      status: "ok",
      revision: 1,
      applicationStatus: "new",
    });
    const row = (await db.query("select revision,status,internal_notes,reviewer_email from creator_applications")).rows[0];
    expect(row).toMatchObject({
      revision: 1,
      status: "new",
      internal_notes: "Private reviewer notes only.",
      reviewer_email: "operator@example.test",
    });
    expect((await db.query("select action,diff from admin_audit_log")).rows[0]).toMatchObject({
      action: "creator.new",
      diff: { fields: ["internal_notes"], fromStatus: "new", toStatus: "new" },
    });
  });

  it("rejects stale and illegal status changes without mutating the record", async () => {
    const id = await createApplication();
    await expect(review(id, 0, "shortlisted", "Good fit.")).resolves.toMatchObject({ status: "ok", revision: 1 });
    await expect(review(id, 0, "declined", "Stale decline.")).resolves.toMatchObject({ status: "stale" });
    await expect(review(id, 1, "new", "No reversal.")).resolves.toMatchObject({ status: "invalid_transition" });
    expect((await db.query("select status,revision,internal_notes from creator_applications")).rows[0]).toMatchObject({
      status: "shortlisted",
      revision: 1,
      internal_notes: "Good fit.",
    });
  });

  it("rolls back application changes if the audit insert fails", async () => {
    const id = await createApplication();
    await db.exec("create function reject_creator_audit() returns trigger language plpgsql as $$begin raise exception 'injected audit failure';end $$;create trigger reject_creator_audit before insert on admin_audit_log for each row execute function reject_creator_audit();");
    try {
      await expect(review(id, 0, "shortlisted", "This should roll back.")).rejects.toThrow("injected audit failure");
    } finally {
      await db.exec("drop trigger reject_creator_audit on admin_audit_log;drop function reject_creator_audit();");
    }
    expect((await db.query("select status,revision,internal_notes from creator_applications")).rows[0]).toMatchObject({
      status: "new",
      revision: 0,
      internal_notes: "",
    });
  });
});
