import { CREATOR_PRIVACY_VERSION } from "./content";
import type {
  Audience,
  CreatorInput,
  Discipline,
  FieldErrors,
  Focus,
  Region,
} from "./types";

const DISCIPLINES: Discipline[] = ["photography", "video", "content"];
const FOCUSES: Focus[] = ["fitness", "health", "biohacking", "other"];
const REGIONS: Region[] = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const AUDIENCES: Array<Audience | ""> = ["", "under-1k", "1k-10k", "10k-50k", "50k-plus"];
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];
const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "socialUrl",
  "portfolioUrl",
  "discipline",
  "focus",
  "region",
  "pitch",
  "audience",
  "adultAustralia",
  "contactConsent",
  "website",
]);
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return SOCIAL_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
}

function text(
  value: unknown,
  field: keyof CreatorInput,
  errors: FieldErrors,
  { min = 0, max, label }: { min?: number; max: number; label: string },
): string {
  if (typeof value !== "string") {
    errors[field] = `${label} is required.`;
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length < min) errors[field] = `${label} is too short.`;
  else if (trimmed.length > max) errors[field] = `${label} is too long.`;
  return trimmed;
}

function normalizeUrl(
  raw: unknown,
  field: keyof CreatorInput,
  errors: FieldErrors,
  options: { required: boolean; max: number; social?: boolean },
): string {
  if (typeof raw !== "string") {
    if (options.required) errors[field] = "Enter a valid HTTPS URL.";
    return "";
  }
  const value = raw.trim();
  if (!value) {
    if (options.required) errors[field] = "Enter a valid HTTPS URL.";
    return "";
  }
  if (value.length > options.max) {
    errors[field] = "URL is too long.";
    return "";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors[field] = "Use a valid HTTPS URL.";
    if (url.username || url.password) errors[field] = "Remove URL credentials.";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) url.searchParams.delete(key);
    }
    if (options.social && !isSocialHost(url.hostname)) {
      errors[field] = "Use an Instagram, TikTok or YouTube profile URL.";
    }
    const normalized = url.toString();
    if (normalized.length > options.max) {
      errors[field] = "URL is too long.";
      return "";
    }
    return normalized;
  } catch {
    errors[field] = "Enter a valid HTTPS URL.";
    return "";
  }
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: keyof CreatorInput,
  errors: FieldErrors,
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    errors[field] = `Choose ${label}.`;
    return allowed[0];
  }
  return value as T;
}

function consent(value: unknown, field: keyof CreatorInput, errors: FieldErrors): boolean {
  if (value !== true) {
    errors[field] = "Required.";
    return false;
  }
  return true;
}

export function validateCreatorInput(
  value: unknown,
): { ok: true; value: CreatorInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isPlainObject(value)) {
    return { ok: false, fieldErrors: { name: "Enter your application details." } };
  }
  if (Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    errors.website = "Remove unexpected fields.";
  }

  const name = text(value.name, "name", errors, { min: 2, max: 80, label: "Full name" });
  const email = text(value.email, "email", errors, { min: 3, max: 254, label: "Email" }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  const socialUrl = normalizeUrl(value.socialUrl, "socialUrl", errors, {
    required: true,
    max: 500,
    social: true,
  });
  let portfolioUrl = "";
  if ("portfolioUrl" in value && typeof value.portfolioUrl !== "string") {
    errors.portfolioUrl = "Portfolio URL must be text.";
  } else {
    portfolioUrl = normalizeUrl(value.portfolioUrl, "portfolioUrl", errors, {
      required: false,
      max: 500,
    });
  }
  const discipline = enumValue(value.discipline, DISCIPLINES, "discipline", errors, "a discipline");
  const focus = enumValue(value.focus, FOCUSES, "focus", errors, "your content focus");
  const region = enumValue(value.region, REGIONS, "region", errors, "your state or territory");
  const pitch = text(value.pitch, "pitch", errors, {
    min: 30,
    max: 1000,
    label: "What you would like to create",
  });
  const audience = enumValue(value.audience ?? "", AUDIENCES, "audience", errors, "an audience range");
  const adultAustralia = consent(value.adultAustralia, "adultAustralia", errors);
  const contactConsent = consent(value.contactConsent, "contactConsent", errors);
  const website = typeof value.website === "string" ? value.website.trim() : "";
  if ("website" in value && typeof value.website !== "string") {
    errors.website = "Leave this field blank.";
  }
  if (website) errors.website = "Leave this field blank.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: {
      name,
      email,
      socialUrl,
      portfolioUrl,
      discipline,
      focus,
      region,
      pitch,
      audience,
      adultAustralia,
      contactConsent,
      website: "",
    },
  };
}

export function canonicalCreatorPayload(input: CreatorInput): string {
  return JSON.stringify({
    privacyVersion: CREATOR_PRIVACY_VERSION,
    name: input.name,
    email: input.email,
    socialUrl: input.socialUrl,
    portfolioUrl: input.portfolioUrl,
    discipline: input.discipline,
    focus: input.focus,
    region: input.region,
    pitch: input.pitch,
    audience: input.audience,
    adultAustralia: input.adultAustralia,
    contactConsent: input.contactConsent,
  });
}
