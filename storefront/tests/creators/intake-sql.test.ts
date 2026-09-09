import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;

const migration = () =>
  db.exec([
    readFileSync(resolve("supabase/migrations/20260909140000_creator_applications.sql"), "utf8"),
    readFileSync(resolve("supabase/migrations/20260909170000_creator_application_details.sql"), "utf8"),
  ].join("\n"));

const rpc = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await db.query<{ r: T }>(`select ${sql} r`, args)).rows[0].r;

const input = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "Taylor Example",
  email: "taylor@example.test",
  social_url: "https://instagram.com/taylor.example/",
  portfolio_url: "",
  discipline: "video",
  focus: "fitness",
  focus_detail: "",
  region: "VIC",
  pitch:
    "I create thoughtful product stories with natural light, careful pacing and a clear point of view.",
  audience: "10k-50k",
  audience_size: 12500,
  phone: "+61400123456",
  adult_australia: true,
  contact_consent: true,
  privacy_version: "creator-privacy-2026-09-09-v3",
  ...overrides,
});

const submit = (key: string, payload = input(), hash = "a".repeat(64), limit = "c".repeat(64)) =>
  rpc<{ status: string }>(
    "creator_submit_application($1::jsonb,$2::uuid,$3,$4,$5)",
    [JSON.stringify(payload), key, hash, "b".repeat(64), limit],
  );

const hex = (n: number) => n.toString(16).repeat(64).slice(0, 64);

describe("creator intake SQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role service_role bypassrls; create role anon; create role authenticated;");
    await db.exec(
      "create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text not null,action text not null,entity_type text,entity_id text,diff jsonb,created_at timestamptz not null default now());",
    );
    await migration();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(
      "truncate creator_application_requests cascade; truncate creator_applications cascade; truncate creator_application_limits cascade; truncate admin_audit_log cascade;",
    );
  });

  it("replays a matching idempotency key and rejects changed payload reuse", async () => {
    const key = "30000000-0000-0000-0000-000000000001";
    await expect(submit(key)).resolves.toEqual({ status: "ok" });
    await expect(submit(key)).resolves.toEqual({ status: "ok" });
    await expect(submit(key, input(), "d".repeat(64))).resolves.toEqual({ status: "conflict" });
    expect((await db.query("select count(*)::int n from creator_applications")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select focus from creator_applications")).rows[0]).toEqual({ focus: "fitness" });
  });

  it("stores new application details and preserves idempotent mismatch protection", async () => {
    const key = "30000000-0000-0000-0000-000000000001";
    const payload = input({
      focus: "other",
      focus_detail: "Outdoor endurance",
      audience: "",
      audience_size: 0,
      phone: "+64211234567",
    });
    await expect(submit(key, payload, "a".repeat(64))).resolves.toEqual({ status: "ok" });
    expect(
      (await db.query("select phone,focus,focus_detail,audience,audience_size from creator_applications")).rows[0],
    ).toEqual({
      phone: "+64211234567",
      focus: "other",
      focus_detail: "Outdoor endurance",
      audience: "under-1k",
      audience_size: 0,
    });
    await expect(submit(key, { ...payload, audience_size: 1 }, "d".repeat(64))).resolves.toEqual({
      status: "conflict",
    });
  });

  it("requires new details for v3 submissions while accepting old rollout payloads", async () => {
    await expect(
      submit("30000000-0000-0000-0000-000000000001", input({ phone: null })),
    ).rejects.toThrow(/phone/i);
    await expect(
      submit("30000000-0000-0000-0000-000000000002", input({ audience_size: null })),
    ).rejects.toThrow(/audience/i);
    await expect(
      submit("30000000-0000-0000-0000-000000000003", input({ focus: "other", focus_detail: "" })),
    ).rejects.toThrow(/focus detail/i);
    await expect(
      submit("30000000-0000-0000-0000-000000000004", input({ audience_size: 2_147_483_648 })),
    ).rejects.toThrow(/audience/i);
    await expect(
      submit("30000000-0000-0000-0000-000000000005", {
        name: "Partial Legacy Creator",
        email: "partial-legacy@example.test",
        social_url: "https://instagram.com/partial.legacy/",
        portfolio_url: "",
        discipline: "content",
        focus: "health",
        region: "NSW",
        pitch: "I create health stories with careful context and a steady point of view.",
        audience: "1k-10k",
        audience_size: 1200,
        adult_australia: true,
        contact_consent: true,
        privacy_version: "creator-privacy-2026-09-09-v2",
      }),
    ).rejects.toThrow(/phone/i);

    const oldPayload = {
      name: "Legacy Creator",
      email: "legacy@example.test",
      social_url: "https://instagram.com/legacy.creator/",
      portfolio_url: "",
      discipline: "content",
      focus: "health",
      region: "NSW",
      pitch: "I create practical health stories with steady product context and clear audience education.",
      audience: "1k-10k",
      adult_australia: true,
      contact_consent: true,
      privacy_version: "creator-privacy-2026-09-09-v2",
    };
    await expect(
      submit("30000000-0000-0000-0000-000000000006", oldPayload, "4".repeat(64), "4".repeat(64)),
    ).resolves.toEqual({ status: "ok" });
    expect(
      (await db.query("select phone,focus_detail,audience,audience_size from creator_applications where email='legacy@example.test'")).rows[0],
    ).toEqual({
      phone: null,
      focus_detail: null,
      audience: "1k-10k",
      audience_size: null,
    });
  });

  it("requires Other focus detail to be typed text trimmed like the JS validator", async () => {
    const invalidDetails = [
      { suffix: "array", focus_detail: [] },
      { suffix: "boolean", focus_detail: true },
      { suffix: "blank", focus_detail: "\t\n " },
      { suffix: "nbsp-bom", focus_detail: "\u00a0\ufeff" },
    ];
    for (const { suffix, focus_detail } of invalidDetails) {
      await expect(
        submit(
          `30000000-0000-0000-0000-${String(100 + invalidDetails.findIndex((entry) => entry.suffix === suffix) + 1).padStart(12, "0")}`,
          input({ focus: "other", focus_detail, email: `detail-${suffix}@example.test` }),
          "5".repeat(64),
          "5".repeat(64),
        ),
      ).rejects.toThrow(/focus detail/i);
    }

    await expect(
      submit(
        "30000000-0000-0000-0000-000000000104",
        input({ focus: "other", focus_detail: "\t\u00a0\ufeff Outdoor endurance \u202f\n" }),
        "6".repeat(64),
        "6".repeat(64),
      ),
    ).resolves.toEqual({ status: "ok" });
    expect((await db.query("select focus_detail from creator_applications")).rows[0]).toEqual({
      focus_detail: "Outdoor endurance",
    });
  });

  it("deduplicates the same email and social profile on the same UTC day without overwriting", async () => {
    const first = "30000000-0000-0000-0000-000000000001";
    const second = "30000000-0000-0000-0000-000000000002";
    await submit(first, input({ name: "Original Name" }), "1".repeat(64), "1".repeat(64));
    await submit(second, input({ name: "Later Name", pitch: "P".repeat(100) }), "2".repeat(64), "2".repeat(64));
    expect((await db.query("select count(*)::int n from creator_applications")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select name from creator_applications")).rows[0]).toEqual({
      name: "Original Name",
    });
    expect((await db.query("select count(*)::int n from creator_application_requests")).rows[0]).toEqual({ n: 2 });
  });

  it("allows ten hourly attempts, records the eleventh as limited, and accepts a different bucket", async () => {
    for (let i = 1; i <= 10; i++) {
      await expect(
        submit(`30000000-0000-0000-0000-${String(i).padStart(12, "0")}`, input({ email: `creator${i}@example.test` }), hex(i), "f".repeat(64)),
      ).resolves.toEqual({ status: "ok" });
    }
    await expect(
      submit("30000000-0000-0000-0000-000000000011", input({ email: "limited@example.test" }), "e".repeat(64), "f".repeat(64)),
    ).resolves.toEqual({ status: "limited" });
    expect((await db.query("select attempt_count from creator_application_limits")).rows[0]).toEqual({
      attempt_count: 11,
    });
    await expect(
      submit("30000000-0000-0000-0000-000000000012", input({ email: "next@example.test" }), "9".repeat(64), "9".repeat(64)),
    ).resolves.toEqual({ status: "ok" });
  });

  it("denies public roles and rejects malformed database input", async () => {
    await expect(submit("30000000-0000-0000-0000-000000000001", input({ focus: "medical" }))).rejects.toThrow();
    for (const role of ["anon", "authenticated"]) {
      expect(
        await rpc("has_function_privilege($1,$2,$3)", [
          role,
          "creator_submit_application(jsonb,uuid,text,text,text)",
          "execute",
        ]),
      ).toBe(false);
      expect(await rpc("has_table_privilege($1,$2,$3)", [role, "creator_applications", "select"])).toBe(false);
    }
    expect(
      await rpc("has_function_privilege($1,$2,$3)", [
        "service_role",
        "creator_submit_application(jsonb,uuid,text,text,text)",
        "execute",
      ]),
    ).toBe(true);
  });

  it("updates reviews atomically and retains accepted records during retention", async () => {
    await submit("30000000-0000-0000-0000-000000000001");
    const id = (await db.query<{ id: string }>("select id from creator_applications")).rows[0].id;
    await expect(
      rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
        id,
        0,
        "shortlisted",
        "Strong portfolio.",
        "operator@example.test",
      ]),
    ).resolves.toMatchObject({ status: "ok", revision: 1 });
    await expect(
      rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
        id,
        0,
        "accepted",
        "Stale update.",
        "operator@example.test",
      ]),
    ).resolves.toMatchObject({ status: "stale" });
    await expect(
      rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
        id,
        1,
        "new",
        "Illegal reversal.",
        "operator@example.test",
      ]),
    ).resolves.toMatchObject({ status: "invalid_transition" });
    expect((await db.query("select action,diff from admin_audit_log")).rows[0]).toMatchObject({
      action: "creator.shortlisted",
    });

    await db.exec("update creator_applications set created_at=now()-interval '181 days'");
    await expect(rpc("creator_retention_sweep()")).resolves.toMatchObject({ applicationsDeleted: 1 });
    await submit("30000000-0000-0000-0000-000000000002", input({ email: "accepted@example.test" }), "2".repeat(64), "2".repeat(64));
    const accepted = (await db.query<{ id: string }>("select id from creator_applications")).rows[0].id;
    await rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
      accepted,
      0,
      "shortlisted",
      "",
      "operator@example.test",
    ]);
    await rpc("creator_review_application($1::uuid,$2,$3,$4,$5)", [
      accepted,
      1,
      "accepted",
      "",
      "operator@example.test",
    ]);
    await db.exec(
      "update creator_applications set created_at=now()-interval '181 days'; update creator_application_limits set window_start=now()-interval '49 hours';",
    );
    await expect(rpc("creator_retention_sweep()")).resolves.toMatchObject({
      applicationsDeleted: 0,
      throttleBucketsDeleted: 2,
    });
  });
});
