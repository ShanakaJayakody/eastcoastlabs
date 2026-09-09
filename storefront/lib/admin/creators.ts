import "server-only";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { adminDb } from "./db";
import type { ApplicationStatus, CreatorApplicationRow } from "@/lib/creators/types";
import { creatorStatusLabel, type CreatorAdminActionResult, type ReviewCreatorApplicationInput } from "@/lib/creators/admin";

export type CreatorApplicationListRow = Pick<
  CreatorApplicationRow,
  | "id"
  | "created_at"
  | "name"
  | "email"
  | "social_url"
  | "portfolio_url"
  | "discipline"
  | "focus"
  | "region"
  | "status"
  | "revision"
>;

export interface CreatorApplicationsPage {
  rows: CreatorApplicationListRow[];
  total: number;
  page: number;
  pages: number;
  status?: ApplicationStatus;
}

const STATUSES: ApplicationStatus[] = ["new", "shortlisted", "accepted", "declined"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

const LIST_FIELDS = [
  "id",
  "created_at",
  "name",
  "email",
  "social_url",
  "portfolio_url",
  "discipline",
  "focus",
  "region",
  "status",
  "revision",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "name",
  "email",
  "social_url",
  "portfolio_url",
  "discipline",
  "focus",
  "region",
  "pitch",
  "audience",
  "adult_australia",
  "contact_consent",
  "privacy_version",
  "consent_at",
  "status",
  "revision",
  "reviewer_email",
  "internal_notes",
].join(",");

function status(value: unknown): ApplicationStatus | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !STATUSES.includes(value as ApplicationStatus)) {
    throw new Error("Invalid creator application status.");
  }
  return value as ApplicationStatus;
}

function pageNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
  }
  return 1;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error("Invalid creator application id.");
  }
  return value;
}

function reviewInput(input: ReviewCreatorApplicationInput): ReviewCreatorApplicationInput | string {
  let id: string;
  try {
    id = uuid(input.id);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid creator application id.";
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return "Review revision is invalid. Reload the application before saving.";
  }
  if (!STATUSES.includes(input.status)) return "Choose a valid creator application status.";
  if (typeof input.notes !== "string") return "Notes must be text.";
  const notes = input.notes.trim();
  if (notes.length > 5000) return "Notes must be 5000 characters or fewer.";
  return { id, expectedRevision: input.expectedRevision, status: input.status, notes };
}

export async function listCreatorApplications(input: { status?: unknown; page?: unknown } = {}): Promise<CreatorApplicationsPage> {
  await requireAdmin();
  const selectedStatus = status(input.status);
  const page = pageNumber(input.page);
  const offset = (page - 1) * PAGE_SIZE;

  let q = adminDb()
    .from("creator_applications")
    .select(LIST_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (selectedStatus) q = q.eq("status", selectedStatus);

  const { data, count, error } = await q;
  if (error) throw new Error(`listCreatorApplications: ${error.message}`);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as CreatorApplicationListRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    status: selectedStatus,
  };
}

export async function getCreatorApplication(id: string): Promise<CreatorApplicationRow | null> {
  await requireAdmin();
  const applicationId = uuid(id);
  const { data, error } = await adminDb()
    .from("creator_applications")
    .select(DETAIL_FIELDS)
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`getCreatorApplication: ${error.message}`);
  return (data ?? null) as CreatorApplicationRow | null;
}

export async function reviewCreatorApplication(input: ReviewCreatorApplicationInput): Promise<CreatorAdminActionResult> {
  const session = await requireAdmin();
  const valid = reviewInput(input);
  if (typeof valid === "string") return { ok: false, error: valid };

  try {
    const { data, error } = await adminDb().rpc("creator_review_application", {
      p_id: valid.id,
      p_expected_revision: valid.expectedRevision,
      p_status: valid.status,
      p_notes: valid.notes,
      p_actor: session.email,
    });
    if (error) throw new Error(error.message);
    const status = (data as { status?: string } | null)?.status;
    if (status === "ok") {
      revalidatePath("/admin/creators");
      revalidatePath(`/admin/creators/${valid.id}`);
      return { ok: true, message: `Application ${creatorStatusLabel(valid.status).toLowerCase()}.` };
    }
    if (status === "stale") {
      return {
        ok: false,
        stale: true,
        error: "This application changed while you were reviewing it. Reload before saving.",
      };
    }
    if (status === "invalid_transition") {
      return { ok: false, error: "That status change is not allowed for this application." };
    }
    if (status === "not_found") return { ok: false, error: "Application not found." };
    return { ok: false, error: "Review could not be saved." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { creatorStatusLabel };
export type { CreatorAdminActionResult, ReviewCreatorApplicationInput };
