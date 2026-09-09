import "server-only";

import { createHmac } from "node:crypto";
import { CREATOR_PRIVACY_VERSION } from "./content";
import { canonicalCreatorPayload } from "./validation";
import type { ApplyResult, CreatorInput } from "./types";
import { supabaseAdmin } from "@/lib/supabase";

export interface CreatorSubmitContext {
  idempotencyKey: string;
  clientAddress: string;
}

type RpcStatus = { status: "ok" | "limited" | "conflict" };

function secret(): string | null {
  const value = process.env.CREATOR_APPLICATION_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

function hmac(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function hourlyBucket(date: Date): string {
  const rounded = new Date(date);
  rounded.setUTCMinutes(0, 0, 0);
  return rounded.toISOString();
}

function toRpcInput(input: CreatorInput) {
  return {
    name: input.name,
    email: input.email,
    social_url: input.socialUrl,
    portfolio_url: input.portfolioUrl,
    discipline: input.discipline,
    focus: input.focus,
    region: input.region,
    pitch: input.pitch,
    audience: input.audience,
    adult_australia: input.adultAustralia,
    contact_consent: input.contactConsent,
    privacy_version: CREATOR_PRIVACY_VERSION,
  };
}

export function creatorApplicationHashes(
  input: CreatorInput,
  context: CreatorSubmitContext,
  key: string,
  now = new Date(),
) {
  return {
    payloadHash: hmac(canonicalCreatorPayload(input), key),
    dedupeKey: hmac(`${input.email}\n${input.socialUrl}`, key),
    limitKey: hmac(`${context.clientAddress}\n${hourlyBucket(now)}`, key),
  };
}

export async function submitCreatorApplication(
  input: CreatorInput,
  context: CreatorSubmitContext,
): Promise<ApplyResult> {
  const key = secret();
  const db = supabaseAdmin();
  if (!key || !db || !context.clientAddress.trim()) return { ok: false, code: "unavailable" };

  const hashes = creatorApplicationHashes(input, context, key);
  try {
    const { data, error } = await db.rpc("creator_submit_application", {
      p_input: toRpcInput(input),
      p_idempotency_key: context.idempotencyKey,
      p_payload_hash: hashes.payloadHash,
      p_dedupe_key: hashes.dedupeKey,
      p_limit_key: hashes.limitKey,
    });
    if (error) return { ok: false, code: "unavailable" };
    const status = (data as RpcStatus | null)?.status;
    if (status === "ok") return { ok: true };
    if (status === "limited") return { ok: false, code: "rate_limited" };
    if (status === "conflict") return { ok: false, code: "conflict" };
    return { ok: false, code: "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}
