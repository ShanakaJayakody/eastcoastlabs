import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({ from: m.from, rpc: m.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import {
  getCreatorApplication,
  listCreatorApplications,
  reviewCreatorApplication,
} from "@/lib/admin/creators";
import CreatorApplicationDetail from "@/components/admin/CreatorApplicationDetail";
import type { CreatorApplicationRow } from "@/lib/creators/types";

const app: CreatorApplicationRow = {
  id: "30000000-0000-0000-0000-000000000001",
  created_at: "2026-09-09T01:00:00.000Z",
  updated_at: "2026-09-09T01:10:00.000Z",
  name: "Taylor <script>alert(1)</script>",
  email: "taylor@example.test",
  social_url: "https://instagram.com/taylor.example/",
  portfolio_url: "https://example.com/portfolio",
  discipline: "video",
  focus: "biohacking",
  region: "VIC",
  pitch: "I make detailed creator stories with a clear point of view for careful audiences.",
  audience: "1k-10k",
  adult_australia: true,
  contact_consent: true,
  privacy_version: "creator-privacy-2026-09-09",
  consent_at: "2026-09-09T01:00:00.000Z",
  status: "new",
  revision: 0,
  reviewer_email: null,
  internal_notes: "",
};

function query(data: unknown[] = [app], count = data.length) {
  const calls: string[] = [];
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn((key: string, value: string) => { calls.push(`${key}:${value}`); return q; }),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    maybeSingle: vi.fn(async () => ({ data: data[0] ?? null, error: null })),
    then: (resolve: (value: unknown) => void) => resolve({ data, count, error: null }),
    calls,
  };
  return q;
}

describe("creator admin operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ email: "operator@example.test", userId: "admin-user" });
  });

  it("requires admin access before listing application records", async () => {
    const q = query();
    m.from.mockReturnValue(q);
    const result = await listCreatorApplications({ status: "new", page: 2 });
    expect(m.requireAdmin).toHaveBeenCalledTimes(1);
    expect(m.from).toHaveBeenCalledWith("creator_applications");
    expect(q.eq).toHaveBeenCalledWith("status", "new");
    expect(q.range).toHaveBeenCalledWith(50, 99);
    expect(result.rows[0]).toMatchObject({ id: app.id, focus: "biohacking" });
  });

  it("does not open the database when the admin gate rejects access", async () => {
    m.requireAdmin.mockRejectedValueOnce(new Error("forbidden"));
    await expect(listCreatorApplications({ status: "new" })).rejects.toThrow("forbidden");
    expect(m.from).not.toHaveBeenCalled();
  });

  it("validates status, page, UUID and note bounds", async () => {
    m.from.mockReturnValue(query());
    await expect(listCreatorApplications({ status: "accepted", page: 0 })).resolves.toMatchObject({ page: 1 });
    await expect(getCreatorApplication("not-a-uuid")).rejects.toThrow("Invalid creator application id");
    await expect(reviewCreatorApplication({
      id: app.id,
      expectedRevision: 0,
      status: "accepted",
      notes: "x".repeat(5001),
    })).resolves.toMatchObject({ ok: false, error: "Notes must be 5000 characters or fewer." });
  });

  it("reviews through the RPC with the authenticated actor and handles stale revisions", async () => {
    m.rpc.mockResolvedValueOnce({ data: { status: "stale", revision: 2, currentStatus: "shortlisted" }, error: null });
    await expect(reviewCreatorApplication({
      id: app.id,
      expectedRevision: 1,
      status: "declined",
      notes: "Already reviewed.",
    })).resolves.toMatchObject({ ok: false, stale: true });
    expect(m.rpc).toHaveBeenCalledWith("creator_review_application", {
      p_id: app.id,
      p_expected_revision: 1,
      p_status: "declined",
      p_notes: "Already reviewed.",
      p_actor: "operator@example.test",
    });
    expect(m.revalidatePath).not.toHaveBeenCalled();

    m.rpc.mockResolvedValueOnce({ data: { status: "ok", revision: 1, applicationStatus: "shortlisted" }, error: null });
    await expect(reviewCreatorApplication({
      id: app.id,
      expectedRevision: 0,
      status: "shortlisted",
      notes: "Strong fit.",
    })).resolves.toMatchObject({ ok: true, message: "Application shortlisted." });
    expect(m.revalidatePath).toHaveBeenCalledWith("/admin/creators");
    expect(m.revalidatePath).toHaveBeenCalledWith(`/admin/creators/${app.id}`);
  });

  it("escapes hostile applicant text and keeps external profile links isolated", () => {
    const html = renderToStaticMarkup(createElement(CreatorApplicationDetail, { application: app }));
    expect(html).toContain("Taylor &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('href="https://instagram.com/taylor.example/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
