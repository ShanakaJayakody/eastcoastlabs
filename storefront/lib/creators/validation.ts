import { CREATOR_PRIVACY_VERSION } from "./content";
import type {
  CreatorInput,
  Discipline,
  FieldErrors,
  Focus,
  Region,
} from "./types";

const DISCIPLINES: Discipline[] = ["photography", "video", "content"];
const FOCUSES: Focus[] = ["fitness", "health", "biohacking", "other"];
const REGIONS: Region[] = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];
const MAX_AUDIENCE_SIZE = 2_147_483_647;
const STALE_FORM_MESSAGE = "This application form has changed. Refresh the page and try again.";
const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "socialUrl",
  "portfolioUrl",
  "discipline",
  "focus",
  "focusDetail",
  "region",
  "pitch",
  "audienceSize",
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

function normalizePhone(value: unknown, errors: FieldErrors): string {
  if (typeof value !== "string") {
    errors.phone = "Enter a valid phone number.";
    return "";
  }
  const stripped = value.trim().replace(/[ \-().]/g, "");
  if (!stripped) {
    errors.phone = "Enter a valid phone number.";
    return "";
  }
  if (!/^\+?\d+$/.test(stripped)) {
    errors.phone = "Use digits and a leading + only.";
    return "";
  }
  if (/^0[23478]\d{8}$/.test(stripped)) return `+61${stripped.slice(1)}`;
  if (/^\+[1-9]\d{7,14}$/.test(stripped)) return stripped;
  errors.phone = "Enter a valid phone number.";
  return "";
}

function normalizeAudienceSize(value: unknown, errors: FieldErrors): number {
  let audienceSize: number | null = null;
  if (typeof value === "number") {
    audienceSize = Number.isFinite(value) && Number.isInteger(value) ? value : null;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    audienceSize = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  }
  if (
    audienceSize === null ||
    !Number.isSafeInteger(audienceSize) ||
    audienceSize < 0 ||
    audienceSize > MAX_AUDIENCE_SIZE
  ) {
    errors.audienceSize = "Enter an exact audience number.";
    return 0;
  }
  return audienceSize;
}

export function validateCreatorInput(
  value: unknown,
): { ok: true; value: CreatorInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isPlainObject(value)) {
    return { ok: false, fieldErrors: { name: "Enter your application details." } };
  }
  if ("audience" in value && (!("phone" in value) || !("audienceSize" in value))) {
    return { ok: false, fieldErrors: { name: STALE_FORM_MESSAGE } };
  }
  if (Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    errors.website = "Remove unexpected fields.";
  }

  const name = text(value.name, "name", errors, { min: 2, max: 80, label: "Full name" });
  const email = text(value.email, "email", errors, { min: 3, max: 254, label: "Email" }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  const phone = normalizePhone(value.phone, errors);

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
  const focusDetail =
    focus === "other"
      ? text(value.focusDetail, "focusDetail", errors, {
          min: 2,
          max: 160,
          label: "Content focus",
        })
      : "";
  const region = enumValue(value.region, REGIONS, "region", errors, "your state or territory");
  const pitch = text(value.pitch, "pitch", errors, {
    min: 30,
    max: 1000,
    label: "What you would like to create",
  });
  const audienceSize = normalizeAudienceSize(value.audienceSize, errors);
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
      phone,
      socialUrl,
      portfolioUrl,
      discipline,
      focus,
      focusDetail,
      region,
      pitch,
      audienceSize,
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
    phone: input.phone,
    socialUrl: input.socialUrl,
    portfolioUrl: input.portfolioUrl,
    discipline: input.discipline,
    focus: input.focus,
    focusDetail: input.focusDetail,
    region: input.region,
    pitch: input.pitch,
    audienceSize: input.audienceSize,
    adultAustralia: input.adultAustralia,
    contactConsent: input.contactConsent,
  });
}
