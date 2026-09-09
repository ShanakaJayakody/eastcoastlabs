"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  disciplineOptions,
  focusOptions,
  regionOptions,
} from "@/lib/creators/content";
import { trackCreatorEvent, type CreatorErrorCode } from "@/lib/analytics";
import { canonicalCreatorPayload, validateCreatorInput } from "@/lib/creators/validation";
import type {
  ApplyResult,
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
];

type FormState = Omit<CreatorInput, "discipline" | "focus" | "region" | "audienceSize"> & {
  discipline: Discipline | "";
  focus: Focus | "";
  region: Region | "";
  audienceSize: string;
};

type ChoiceField = "discipline" | "focus" | "region";
type StepId =
  | "name"
  | "email"
  | "phone"
  | "socialUrl"
  | "portfolioUrl"
  | "discipline"
  | "focus"
  | "region"
  | "pitch"
  | "audience"
  | "eligibility"
  | "review";

type Step = {
  id: StepId;
  eyebrow: string;
  title: string;
  help?: string;
  fields: Array<keyof CreatorInput>;
  optional?: boolean;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  socialUrl: "",
  portfolioUrl: "",
  discipline: "",
  focus: "",
  focusDetail: "",
  region: "",
  pitch: "",
  audienceSize: "",
  adultAustralia: false,
  contactConsent: false,
  website: "",
};

const steps: Step[] = [
  {
    id: "name",
    eyebrow: "Start with you",
    title: "What should we call you?",
    fields: ["name"],
  },
  {
    id: "email",
    eyebrow: "Best contact",
    title: "Where can we reach you?",
    fields: ["email"],
  },
  {
    id: "phone",
    eyebrow: "Direct follow-up",
    title: "What's the best phone number for your application?",
    help: "Use an Australian mobile number or include your country code.",
    fields: ["phone"],
  },
  {
    id: "socialUrl",
    eyebrow: "Primary channel",
    title: "Where can we find your work?",
    help: "Instagram, TikTok or YouTube works best for the first review.",
    fields: ["socialUrl"],
  },
  {
    id: "portfolioUrl",
    eyebrow: "Optional context",
    title: "Anything else you'd like us to see?",
    help: "A portfolio or another profile is useful if you have one. Otherwise, you can skip this.",
    fields: ["portfolioUrl"],
    optional: true,
  },
  {
    id: "discipline",
    eyebrow: "Format",
    title: "What do you usually make?",
    fields: ["discipline"],
  },
  {
    id: "focus",
    eyebrow: "Content",
    title: "What do you usually cover?",
    fields: ["focus", "focusDetail"],
  },
  {
    id: "region",
    eyebrow: "Australia",
    title: "Which state or territory are you based in?",
    fields: ["region"],
  },
  {
    id: "pitch",
    eyebrow: "Your idea",
    title: "What would you make for ECL?",
    help:
      "Tell us a little about your audience and an idea for the posts. Include recent organic views and your Australian audience share if you know them. We’ll ask for platform insights later.",
    fields: ["pitch"],
  },
  {
    id: "audience",
    eyebrow: "Audience size",
    title: "How large is your audience?",
    help: "Enter the number of followers or subscribers for your primary profile. Use 0 if you do not have an audience yet.",
    fields: ["audienceSize"],
  },
  {
    id: "eligibility",
    eyebrow: "Before review",
    title: "A couple of final details.",
    fields: ["adultAustralia", "contactConsent"],
  },
  {
    id: "review",
    eyebrow: "Final check",
    title: "Review your application",
    help: "Nothing is sent until you choose Send my application.",
    fields: fieldOrder,
  },
];

const reviewIndex = steps.findIndex((step) => step.id === "review");

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
        return { ok: false, code: "validation", fieldErrors: result.fieldErrors as FieldErrors };
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

function optionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
  fallback = "Not shared",
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function firstErrorField(fieldErrors: FieldErrors) {
  return fieldOrder.find((candidate) => candidate !== "website" && fieldErrors[candidate]);
}

function stepIndexForField(field: keyof CreatorInput) {
  const index = steps.findIndex((step) => step.fields.includes(field));
  return index >= 0 ? index : reviewIndex;
}

function firstFocusableField(step: Step): keyof CreatorInput | null {
  if (step.id === "review") return null;
  return step.fields.find((field) => field !== "website") ?? null;
}

function fieldDescription(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

function isChoiceField(field: keyof CreatorInput): field is ChoiceField {
  return field === "discipline" || field === "focus" || field === "region";
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
  const [stepIndex, setStepIndex] = useState(0);
  const keyRef = useRef<string | null>(null);
  const canonicalRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const returnToReviewRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const nestedFocusTimerRef = useRef<number | null>(null);
  const refs = useRef<Partial<Record<keyof CreatorInput, HTMLElement | null>>>({});
  const successRef = useRef<HTMLHeadingElement | null>(null);

  const step = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const firstName = form.name.trim().split(/\s+/)[0];
  const stepEyebrow = step.id === "email" && firstName ? `Hi ${firstName}` : step.eyebrow;
  const hasEnterHint =
    step.id === "name" ||
    step.id === "email" ||
    step.id === "phone" ||
    step.id === "socialUrl" ||
    step.id === "portfolioUrl" ||
    step.id === "audience";

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
      if (nestedFocusTimerRef.current !== null) window.clearTimeout(nestedFocusTimerRef.current);
    };
  }, []);

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

  const updateChoice = (field: ChoiceField, value: string) => {
    if (field === "discipline") update("discipline", value as Discipline);
    else if (field === "focus") {
      setForm((current) => ({
        ...current,
        focus: value as Focus,
        focusDetail: value === "other" ? current.focusDetail : "",
      }));
      setErrors((current) => ({ ...current, focus: undefined, focusDetail: undefined }));
      setGlobalError("");
    }
    else if (field === "region") update("region", value as Region);
  };

  const trackError = (code: CreatorErrorCode) => {
    trackCreatorEvent("creator_application_error", { errorCode: code });
  };

  const focusTargetForField = (field: keyof CreatorInput) => {
    if (isChoiceField(field)) {
      return formRef.current?.querySelector<HTMLInputElement>(`input[name="creator-${field}"]:checked`) ?? refs.current[field];
    }
    return refs.current[field];
  };

  const focusStep = (index: number, field?: keyof CreatorInput) => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    if (nestedFocusTimerRef.current !== null) window.clearTimeout(nestedFocusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      if (typeof formRef.current?.scrollIntoView === "function") {
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        formRef.current.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      }
      nestedFocusTimerRef.current = window.setTimeout(() => {
        const targetField = field ?? firstFocusableField(steps[index]);
        const target = targetField ? focusTargetForField(targetField) : stepHeadingRef.current;
        target?.focus({ preventScroll: true });
      }, 40);
    }, 0);
  };

  const moveToStep = (index: number, field?: keyof CreatorInput) => {
    setStepIndex(index);
    focusStep(index, field);
  };

  const focusFirst = (fieldErrors: FieldErrors, keepReviewReturn = false) => {
    const field = firstErrorField(fieldErrors);
    if (!field) {
      stepHeadingRef.current?.focus({ preventScroll: true });
      return;
    }
    returnToReviewRef.current = keepReviewReturn;
    const targetIndex = stepIndexForField(field);
    moveToStep(targetIndex, field);
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

  const activeErrors = (fields: Array<keyof CreatorInput>) => {
    const validation = validateCreatorInput(form);
    if (validation.ok) return {};
    return fields.reduce<FieldErrors>((current, field) => {
      if (validation.fieldErrors[field]) current[field] = validation.fieldErrors[field];
      return current;
    }, {});
  };

  const completeStep = () => {
    if (pending) return;
    const fieldErrors = activeErrors(step.fields);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setGlobalError(errorMessage("validation"));
      trackError("validation");
      focusFirst(fieldErrors, returnToReviewRef.current);
      return;
    }

    setErrors({});
    setGlobalError("");
    const nextIndex = returnToReviewRef.current ? reviewIndex : Math.min(stepIndex + 1, reviewIndex);
    returnToReviewRef.current = false;
    moveToStep(nextIndex);
  };

  const skipStep = () => {
    if (pending) return;
    if (step.id === "portfolioUrl") update("portfolioUrl", "");
    setErrors({});
    setGlobalError("");
    const nextIndex = returnToReviewRef.current ? reviewIndex : Math.min(stepIndex + 1, reviewIndex);
    returnToReviewRef.current = false;
    moveToStep(nextIndex);
  };

  const back = () => {
    if (pending || stepIndex === 0) return;
    returnToReviewRef.current = false;
    setGlobalError("");
    moveToStep(stepIndex - 1);
  };

  const edit = (field: keyof CreatorInput) => {
    if (pending) return;
    returnToReviewRef.current = true;
    setGlobalError("");
    moveToStep(stepIndexForField(field), field);
  };

  const submitReview = async () => {
    if (pending) return;
    const validation = validateCreatorInput(form);
    if (!validation.ok) {
      setErrors(validation.fieldErrors);
      setGlobalError(errorMessage("validation"));
      trackError("validation");
      focusFirst(validation.fieldErrors, true);
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
        focusFirst(result.fieldErrors, true);
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

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.id === "review") void submitReview();
  };

  const onSingleLineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat) completeStep();
  };

  if (sent) {
    return (
      <div role="status" className={styles.successPanel}>
        <h3 ref={successRef} tabIndex={-1}>Your application is in.</h3>
        <p>
          Thanks for sending it through. We&apos;ll read your application and email you if
          there&apos;s a fit. We&apos;ll then check your audience insights and agree the products
          and posting brief with you.
        </p>
      </div>
    );
  }

  const described = (field: keyof CreatorInput, helpId?: string) =>
    fieldDescription(helpId, errors[field] ? `${field}-error` : undefined);

  const renderTextStep = (
    field: "name" | "email" | "phone" | "socialUrl" | "portfolioUrl" | "audienceSize",
    details: {
      id: string;
      labelId: string;
      label: string;
      type?: string;
      inputMode?: "email" | "url" | "tel" | "numeric";
      autoComplete?: string;
      placeholder?: string;
      helpId?: string;
      pattern?: string;
    },
  ) => (
    <label htmlFor={details.id} className={styles.wizardField}>
      <span id={details.labelId}>{details.label}</span>
      {step.help && details.helpId && <small id={details.helpId} className={styles.fieldHelp}>{step.help}</small>}
      <input
        id={details.id}
        aria-labelledby={details.labelId}
        ref={(node) => { refs.current[field] = node; }}
        value={form[field]}
        onChange={(event) => update(field, event.target.value)}
        onKeyDown={onSingleLineKeyDown}
        autoComplete={details.autoComplete}
        inputMode={details.inputMode}
        type={details.type}
        pattern={details.pattern}
        placeholder={details.placeholder}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={described(field, details.helpId)}
      />
      {errors[field] && <small id={`${field}-error`}>{errors[field]}</small>}
    </label>
  );

  const renderChoices = (
    field: ChoiceField,
    options: Array<{ value: string; label: string }>,
    compact = false,
  ) => (
    <fieldset
      className={`${styles.choiceGroup} ${compact ? styles.choiceGroupCompact : ""}`}
      aria-describedby={described(field)}
      aria-invalid={Boolean(errors[field])}
    >
      <legend id={`creator-${field}-label`}>
        {field === "discipline"
          ? "Main discipline"
          : field === "focus"
            ? "Your content focus"
            : "Australian state/territory"}
      </legend>
      <div className={styles.choiceList}>
        {options.map((option, index) => {
          const id = `creator-${field}-${option.value || "empty"}`;
          return (
            <label key={id} htmlFor={id} className={styles.choiceCard}>
              <input
                id={id}
                ref={(node) => {
                  if (node && (form[field] === option.value || (!form[field] && index === 0))) {
                    refs.current[field] = node;
                  }
                }}
                type="radio"
                name={`creator-${field}`}
                value={option.value}
                checked={form[field] === option.value}
                onChange={(event) => updateChoice(field, event.target.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {field === "focus" && form.focus === "other" && (
        <label htmlFor="creator-focus-detail" className={`${styles.wizardField} ${styles.nestedField}`}>
          <span id="creator-focus-detail-label">Tell us what you love talking about</span>
          <small id="creator-focus-detail-help" className={styles.fieldHelp}>
            A short phrase is enough.
          </small>
          <input
            id="creator-focus-detail"
            aria-labelledby="creator-focus-detail-label"
            ref={(node) => { refs.current.focusDetail = node; }}
            value={form.focusDetail}
            maxLength={160}
            onChange={(event) => update("focusDetail", event.target.value)}
            onKeyDown={onSingleLineKeyDown}
            aria-invalid={Boolean(errors.focusDetail)}
            aria-describedby={described("focusDetail", "creator-focus-detail-help")}
          />
          {errors.focusDetail && <small id="focusDetail-error">{errors.focusDetail}</small>}
        </label>
      )}
      {errors[field] && <small id={`${field}-error`}>{errors[field]}</small>}
    </fieldset>
  );

  const renderEligibility = () => (
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
          <Link href="/creators/privacy" target="_blank" rel="noopener noreferrer">
            Creator Privacy Notice
            <span className={styles.visuallyHidden}> (opens in a new tab)</span>
          </Link>.
        </span>
      </label>
      {errors.contactConsent && <small id="contactConsent-error">{errors.contactConsent}</small>}
    </div>
  );

  const renderPitch = () => (
    <label htmlFor="creator-pitch" className={styles.wizardField}>
      <span id="creator-pitch-label">Tell us about your audience and content</span>
      <small id="creator-pitch-help" className={styles.fieldHelp}>{step.help}</small>
      <textarea
        id="creator-pitch"
        aria-labelledby="creator-pitch-label"
        ref={(node) => { refs.current.pitch = node; }}
        value={form.pitch}
        onChange={(event) => update("pitch", event.target.value)}
        rows={7}
        aria-invalid={Boolean(errors.pitch)}
        aria-describedby={described("pitch", "creator-pitch-help")}
      />
      {errors.pitch && <small id="pitch-error">{errors.pitch}</small>}
    </label>
  );

  const renderReview = () => {
    const rows: Array<{ label: string; value: string; field: keyof CreatorInput }> = [
      { label: "Full name", value: form.name || "Missing", field: "name" },
      { label: "Email address", value: form.email || "Missing", field: "email" },
      { label: "Phone number", value: form.phone || "Missing", field: "phone" },
      { label: "Primary social profile", value: form.socialUrl || "Missing", field: "socialUrl" },
      { label: "Portfolio", value: form.portfolioUrl || "Not shared", field: "portfolioUrl" },
      {
        label: "Main discipline",
        value: optionLabel(disciplineOptions, form.discipline, "Missing"),
        field: "discipline",
      },
      {
        label: "Content focus",
        value:
          form.focus === "other" && form.focusDetail.trim()
            ? `Other: ${form.focusDetail.trim()}`
            : optionLabel(focusOptions, form.focus, "Missing"),
        field: "focus",
      },
      {
        label: "State/territory",
        value: optionLabel(regionOptions, form.region, "Missing"),
        field: "region",
      },
      { label: "Pitch", value: form.pitch || "Missing", field: "pitch" },
      {
        label: "Audience size",
        value: form.audienceSize.trim() || "Missing",
        field: "audienceSize",
      },
    ];

    return (
      <section className={styles.reviewPanel} aria-label="Application summary">
        <p>Make any last edits, then send it through for the ECL team to review.</p>
        <div className={styles.reviewList}>
          {rows.map((row) => (
            <div key={row.label} className={styles.reviewRow}>
              <p className={styles.reviewTerm}>{row.label}</p>
              <p className={styles.reviewValue}>{row.value}</p>
              <button type="button" onClick={() => edit(row.field)} disabled={pending}>
                Edit {row.label}
              </button>
            </div>
          ))}
          <div className={styles.reviewRow}>
            <p className={styles.reviewTerm}>Eligibility</p>
            <p className={styles.reviewValue}>
              {form.adultAustralia && form.contactConsent ? "Confirmed" : "Needs confirmation"}
            </p>
            <button type="button" onClick={() => edit("adultAustralia")} disabled={pending}>
              Edit Eligibility
            </button>
          </div>
        </div>
      </section>
    );
  };

  const renderStepControl = () => {
    if (step.id === "name") {
      return renderTextStep("name", {
        id: "creator-name",
        labelId: "creator-name-label",
        label: "Full name",
        autoComplete: "name",
      });
    }
    if (step.id === "email") {
      return renderTextStep("email", {
        id: "creator-email",
        labelId: "creator-email-label",
        label: "Email address",
        autoComplete: "email",
        inputMode: "email",
        type: "email",
      });
    }
    if (step.id === "phone") {
      return renderTextStep("phone", {
        id: "creator-phone",
        labelId: "creator-phone-label",
        label: "Phone number",
        autoComplete: "tel",
        inputMode: "tel",
        type: "tel",
        placeholder: "0412 345 678",
        helpId: "creator-phone-help",
      });
    }
    if (step.id === "socialUrl") {
      return renderTextStep("socialUrl", {
        id: "creator-social",
        labelId: "creator-social-label",
        label: "Primary social profile",
        inputMode: "url",
        type: "url",
        placeholder: "https://instagram.com/...",
        helpId: "creator-social-help",
      });
    }
    if (step.id === "portfolioUrl") {
      return renderTextStep("portfolioUrl", {
        id: "creator-portfolio",
        labelId: "creator-portfolio-label",
        label: "Portfolio URL (optional)",
        inputMode: "url",
        type: "url",
        placeholder: "https://...",
        helpId: "creator-portfolio-help",
      });
    }
    if (step.id === "discipline") return renderChoices("discipline", disciplineOptions);
    if (step.id === "focus") return renderChoices("focus", focusOptions);
    if (step.id === "region") return renderChoices("region", regionOptions, true);
    if (step.id === "pitch") return renderPitch();
    if (step.id === "audience") {
      return renderTextStep("audienceSize", {
        id: "creator-audience-size",
        labelId: "creator-audience-size-label",
        label: "Audience size",
        inputMode: "numeric",
        pattern: "[0-9]*",
        helpId: "creator-audience-size-help",
      });
    }
    if (step.id === "eligibility") return renderEligibility();
    return renderReview();
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.wizardTop}>
        <p className={styles.progressText} aria-live="polite">
          Question {stepIndex + 1} of {steps.length}
        </p>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {globalError && (
        <p role="alert" className={styles.formAlert}>
          {globalError}
        </p>
      )}

      <div className={styles.wizardStep} key={step.id}>
        <div className={styles.stepIntro}>
          <p className={styles.kicker}>{stepEyebrow}</p>
          <h3 ref={stepHeadingRef} tabIndex={-1}>{step.title}</h3>
          {step.help && step.id === "review" && <p>{step.help}</p>}
        </div>

        {step.id === "review" ? (
          renderStepControl()
        ) : (
          <fieldset disabled={pending} className={styles.formFields}>
            {renderStepControl()}
            {hasEnterHint && (
              <p className={styles.enterHint}>
                {step.optional ? "Press Enter to continue, or skip for now." : "Press Enter to continue."}
              </p>
            )}
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
        )}
      </div>

      <div className={styles.wizardControls}>
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              back();
            }}
            disabled={pending}
            className={styles.backButton}
          >
            Back
          </button>
        )}
        <div className={styles.forwardControls}>
          {step.optional && step.id !== "review" && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                skipStep();
              }}
              disabled={pending}
              className={styles.skipButton}
            >
              Skip for now
            </button>
          )}
          {step.id === "review" ? (
            <button type="submit" disabled={pending} className={styles.submitButton}>
              {pending ? "Sending application..." : "Send my application"}
              <span aria-hidden="true">-&gt;</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                completeStep();
              }}
              disabled={pending}
              className={styles.nextButton}
            >
              Continue
              <span aria-hidden="true">-&gt;</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
