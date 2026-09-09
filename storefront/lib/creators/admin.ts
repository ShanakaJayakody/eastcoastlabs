import type { ApplicationStatus } from "./types";

export interface ReviewCreatorApplicationInput {
  id: string;
  expectedRevision: number;
  status: ApplicationStatus;
  notes: string;
}

export interface CreatorAdminActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  stale?: boolean;
}

export function creatorStatusLabel(value: ApplicationStatus): string {
  if (value === "new") return "New";
  if (value === "shortlisted") return "Shortlisted";
  if (value === "accepted") return "Accepted";
  return "Declined";
}
