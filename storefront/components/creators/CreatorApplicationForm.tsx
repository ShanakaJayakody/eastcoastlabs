"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  audienceOptions,
  disciplineOptions,
  focusOptions,
  regionOptions,
} from "@/lib/creators/content";
import { trackCreatorEvent, type CreatorErrorCode } from "@/lib/analytics";
import { canonicalCreatorPayload, validateCreatorInput } from "@/lib/creators/validation";
import type {
  ApplyResult,
  Audience,
  CreatorInput,
  Discipline,
  FieldErrors,
  Focus,
  Region,
} from "@/lib/creators/types";
import styles from "@/app/(store)/creators/creators.module.css";

const SESSION_KEY = "ecl_creator_application_request";
const fieldOrder: Array<keyof CreatorInput> = [
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
];

type FormState = Omit<CreatorInput, "discipline" | "focus" | "region" | "audience"> & {
  discipline: Discipline | "";
  focus: Focus | "";
  region: Region | "";
  audience: Audience | "";
};

const initialForm: FormState = {
  name: "",
  email: "",
  socialUrl: "",
  portfolioUrl: "",
  discipline: "",
  focus: "",
  region: "",
  pitch: "",
  audience: "",
  adultAustralia: false,
  contactConsent: false,
  website: "",
};

function newKey() {
  return crypto.randomUUID();
}

function storedKey() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Storage is optional; the in-memory key still protects uncertain retries. */
  }
}

function parseResult(value: unknown): ApplyResult {
  if (value && typeof value === "object" && "ok" in value) {
    const result = value as ApplyResult;
    if (result.ok === true) return { ok: true };
    if (result.ok === false) {
      if (result.code === "validation" && "fieldErrors" in result) {
        return { ok: false, code: "validation", fieldErrors: result.fieldErrors };
      }
      if (
        result.code === "rate_limited" ||
        result.code === "unavailable" ||
        result.code === "invalid_request" ||
        result.code === "conflict" ||
        result.code === "network"
      ) {
        return { ok: false, code: result.code };
      }
    }
  }
  return { ok: false, code: "unavailable" };
}

async function defaultSubmit(input: CreatorInput, key: string): Promise<ApplyResult> {
  let response: Response;
  try {
    response = await fetch("/api/creators/apply", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const parsed = parseResult(body);
  if (response.ok && parsed.ok) return parsed;
  if (response.status === 422 && !parsed.ok && parsed.code === "validation") return parsed;
  if (response.status === 429) return { ok: false, code: "rate_limited" };
  if (response.status === 409) return { ok: false, code: "conflict" };
  if (response.status === 400) return { ok: false, code: "invalid_request" };
  return !parsed.ok ? parsed : { ok: false, code: "unavailable" };
}

function errorMessage(code: Exclude<ApplyResult, { ok: true }>["code"]) {
  if (code === "rate_limited") return "Too many attempts. Please try again in about an hour.";
  if (code === "conflict") return "This retry could not be matched to these details. Please review the form before trying again.";
  if (code === "invalid_request") return "We could not read that application request. Your details are still here. Please try again.";
  if (code === "validation") return "Please correct the highlighted fields.";
  return code === "unavailable"
    ? "Applications are temporarily unavailable. Please try again later or contact ECL."
    : "We couldn't confirm your application was saved. Your details are still here. Please try again.";
}

export default function CreatorApplicationForm({
  submit = defaultSubmit,
}: {
  submit?: (input: CreatorInput, key: string) => Promise<ApplyResult>;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const keyRef = useRef<string | null>(null);
  const canonicalRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const refs = useRef<Partial<Record<keyof CreatorInput, HTMLElement | null>>>({});
  const successRef = useRef<HTMLHeadingElement | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (!startedRef.current && key !== "website") {
      const meaningful =
        typeof value === "string" ? value.trim().length > 0 : value === true;
      if (meaningful) {
        startedRef.current = true;
        trackCreatorEvent("creator_application_start");
      }
    }
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setGlobalError("");
  };

  const trackError = (code: CreatorErrorCode) => {
    trackCreatorEvent("creator_application_error", { errorCode: code });
  };

  const focusFirst = (fieldErrors: FieldErrors) => {
    const field = fieldOrder.find((candidate) => fieldErrors[candidate]);
    if (field) refs.current[field]?.focus();
  };

  const ensureKey = (canonical: string) => {
    if (!keyRef.current) keyRef.current = storedKey();
    if (!keyRef.current || canonicalRef.current !== canonical) {
      keyRef.current = newKey();
      canonicalRef.current = canonical;
      writeKey(keyRef.current);
    }
    return keyRef.current;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const validation = validateCreatorInput(form);
    if (!validation.ok) {
      setErrors(validation.fieldErrors);
      setGlobalError(errorMessage("validation"));
      trackError("validation");
      window.setTimeout(() => focusFirst(validation.fieldErrors), 0);
      return;
    }

    const canonical = canonicalCreatorPayload(validation.value);
    const key = ensureKey(canonical);
    setPending(true);
    setErrors({});
    setGlobalError("");
    try {
      const result = await submit(validation.value, key);
      if (result.ok) {
        trackCreatorEvent("creator_application_submit");
        setSent(true);
        keyRef.current = null;
        canonicalRef.current = null;
        writeKey(null);
        window.setTimeout(() => successRef.current?.focus(), 0);
      } else if (result.code === "validation") {
        setErrors(result.fieldErrors);
        setGlobalError(errorMessage("validation"));
        trackError("validation");
        window.setTimeout(() => focusFirst(result.fieldErrors), 0);
      } else {
        setGlobalError(errorMessage(result.code));
        trackError(result.code);
      }
    } catch {
      setGlobalError(errorMessage("network"));
      trackError("network");
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className={styles.successPanel}>
        <h3 ref={successRef} tabIndex={-1}>Your application is in.</h3>
        <p>
          Thanks for introducing your community. We&apos;ll review your application and contact
          you by email if there&apos;s a fit. The next step is to confirm your audience insights
          and agree your first product and posting brief.
        </p>
      </div>
    );
  }

  const described = (field: keyof CreatorInput) => (errors[field] ? `${field}-error` : undefined);

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {globalError && (
        <p role="alert" className={styles.formAlert}>
          {globalError}
        </p>
      )}
      <fieldset disabled={pending} className={styles.formFields}>
        <div className={styles.formGrid}>
          <label htmlFor="creator-name">
          <span id="creator-name-label">Full name</span>
          <input
            id="creator-name"
            aria-labelledby="creator-name-label"
            ref={(node) => { refs.current.name = node; }}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={described("name")}
          />
          {errors.name && <small id="name-error">{errors.name}</small>}
          </label>
          <label htmlFor="creator-email">
          <span id="creator-email-label">Email address</span>
          <input
            id="creator-email"
            aria-labelledby="creator-email-label"
            ref={(node) => { refs.current.email = node; }}
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            inputMode="email"
            type="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={described("email")}
          />
          {errors.email && <small id="email-error">{errors.email}</small>}
          </label>
          <label htmlFor="creator-social">
          <span id="creator-social-label">Primary social profile</span>
          <input
            id="creator-social"
            aria-labelledby="creator-social-label"
            ref={(node) => { refs.current.socialUrl = node; }}
            value={form.socialUrl}
            onChange={(event) => update("socialUrl", event.target.value)}
            inputMode="url"
            type="url"
            placeholder="https://instagram.com/..."
            aria-invalid={Boolean(errors.socialUrl)}
            aria-describedby={described("socialUrl")}
          />
          {errors.socialUrl && <small id="socialUrl-error">{errors.socialUrl}</small>}
          </label>
          <label htmlFor="creator-portfolio">
          <span id="creator-portfolio-label">Portfolio URL <em>(optional)</em></span>
          <input
            id="creator-portfolio"
            aria-labelledby="creator-portfolio-label"
            ref={(node) => { refs.current.portfolioUrl = node; }}
            value={form.portfolioUrl}
            onChange={(event) => update("portfolioUrl", event.target.value)}
            inputMode="url"
            type="url"
            placeholder="https://..."
            aria-invalid={Boolean(errors.portfolioUrl)}
            aria-describedby={described("portfolioUrl")}
          />
          {errors.portfolioUrl && <small id="portfolioUrl-error">{errors.portfolioUrl}</small>}
          </label>
          <label htmlFor="creator-discipline">
          <span id="creator-discipline-label">Main discipline</span>
          <select
            id="creator-discipline"
            aria-labelledby="creator-discipline-label"
            ref={(node) => { refs.current.discipline = node; }}
            value={form.discipline}
            onChange={(event) => update("discipline", event.target.value as Discipline)}
            aria-invalid={Boolean(errors.discipline)}
            aria-describedby={described("discipline")}
          >
            <option value="">Choose one</option>
            {disciplineOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.discipline && <small id="discipline-error">{errors.discipline}</small>}
          </label>
          <label htmlFor="creator-focus">
          <span id="creator-focus-label">Your content focus</span>
          <select
            id="creator-focus"
            aria-labelledby="creator-focus-label"
            ref={(node) => { refs.current.focus = node; }}
            value={form.focus}
            onChange={(event) => update("focus", event.target.value as Focus)}
            aria-invalid={Boolean(errors.focus)}
            aria-describedby={described("focus")}
          >
            <option value="">Choose one</option>
            {focusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.focus && <small id="focus-error">{errors.focus}</small>}
          </label>
          <label htmlFor="creator-region">
          <span id="creator-region-label">Australian state/territory</span>
          <select
            id="creator-region"
            aria-labelledby="creator-region-label"
            ref={(node) => { refs.current.region = node; }}
            value={form.region}
            onChange={(event) => update("region", event.target.value as Region)}
            aria-invalid={Boolean(errors.region)}
            aria-describedby={described("region")}
          >
            <option value="">Choose one</option>
            {regionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.region && <small id="region-error">{errors.region}</small>}
          </label>
          <label htmlFor="creator-audience">
          <span id="creator-audience-label">Audience size <em>(optional)</em></span>
          <select
            id="creator-audience"
            aria-labelledby="creator-audience-label"
            ref={(node) => { refs.current.audience = node; }}
            value={form.audience}
            onChange={(event) => update("audience", event.target.value as Audience | "")}
            aria-invalid={Boolean(errors.audience)}
            aria-describedby={described("audience")}
          >
            {audienceOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.audience && <small id="audience-error">{errors.audience}</small>}
          </label>
        </div>
        <label htmlFor="creator-pitch" className={styles.pitchField}>
        <span id="creator-pitch-label">Tell us about your audience and content</span>
        <small id="creator-pitch-help" className={styles.fieldHelp}>
          Share who you reach, typical organic views on recent posts, your Australian audience
          share if known, and an idea for three original posts. We confirm platform insights
          during the fit review. No media-kit upload needed.
        </small>
        <textarea
          id="creator-pitch"
          aria-labelledby="creator-pitch-label"
          ref={(node) => { refs.current.pitch = node; }}
          value={form.pitch}
          onChange={(event) => update("pitch", event.target.value)}
          rows={6}
          aria-invalid={Boolean(errors.pitch)}
          aria-describedby={["creator-pitch-help", described("pitch")].filter(Boolean).join(" ")}
        />
        {errors.pitch && <small id="pitch-error">{errors.pitch}</small>}
        </label>
        <div className={styles.checks}>
        <label htmlFor="creator-adult-australia">
          <input
            id="creator-adult-australia"
            ref={(node) => { refs.current.adultAustralia = node; }}
            type="checkbox"
            checked={form.adultAustralia}
            onChange={(event) => update("adultAustralia", event.target.checked)}
            aria-invalid={Boolean(errors.adultAustralia)}
            aria-describedby={described("adultAustralia")}
          />
          <span>I am 18 or over and based in Australia.</span>
        </label>
        {errors.adultAustralia && <small id="adultAustralia-error">{errors.adultAustralia}</small>}
        <label htmlFor="creator-contact-consent">
          <input
            id="creator-contact-consent"
            ref={(node) => { refs.current.contactConsent = node; }}
            type="checkbox"
            checked={form.contactConsent}
            onChange={(event) => update("contactConsent", event.target.checked)}
            aria-invalid={Boolean(errors.contactConsent)}
            aria-describedby={described("contactConsent")}
          />
          <span>
            I agree that ECL may review my application and contact me about it, as described in the{" "}
            <Link href="/creators/privacy">Creator Privacy Notice</Link>.
          </span>
        </label>
        {errors.contactConsent && <small id="contactConsent-error">{errors.contactConsent}</small>}
        </div>
        <label htmlFor="creator-website" className={styles.honeypot} aria-hidden="true">
        Website
        <input
          id="creator-website"
          ref={(node) => { refs.current.website = node; }}
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => update("website", event.target.value)}
        />
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className={styles.submitButton}>
        {pending ? "Sending application..." : "Send my application"}
        <span aria-hidden="true">-&gt;</span>
      </button>
    </form>
  );
}
