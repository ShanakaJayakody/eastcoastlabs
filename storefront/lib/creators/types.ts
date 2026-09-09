export type Discipline = "photography" | "video" | "content";
export type Focus = "fitness" | "health" | "biohacking" | "other";
export type Region = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";
export type Audience = "under-1k" | "1k-10k" | "10k-50k" | "50k-plus";
export type ApplicationStatus = "new" | "shortlisted" | "accepted" | "declined";

export interface CreatorInput {
  name: string;
  email: string;
  socialUrl: string;
  portfolioUrl: string;
  discipline: Discipline;
  focus: Focus;
  region: Region;
  pitch: string;
  audience: Audience | "";
  adultAustralia: boolean;
  contactConsent: boolean;
  website: string;
}

export type FieldErrors = Partial<Record<keyof CreatorInput, string>>;

export type ApplyResult =
  | { ok: true }
  | { ok: false; code: "validation"; fieldErrors: FieldErrors }
  | {
      ok: false;
      code: "rate_limited" | "unavailable" | "invalid_request" | "conflict" | "network";
    };

export interface CreatorApplicationRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  social_url: string;
  portfolio_url: string;
  discipline: Discipline;
  focus: Focus;
  region: Region;
  pitch: string;
  audience: Audience | "";
  adult_australia: boolean;
  contact_consent: boolean;
  privacy_version: string;
  consent_at: string;
  status: ApplicationStatus;
  revision: number;
  reviewer_email: string | null;
  internal_notes: string;
}
