import { NextResponse } from "next/server";
import { submitCreatorApplication } from "@/lib/creators/applications";
import { validateCreatorInput } from "@/lib/creators/validation";

const MAX_BYTES = 16 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function noStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function allowedOrigins(): Set<string> {
  const configured =
    process.env.CREATOR_ALLOWED_ORIGINS ??
    "https://www.eastcoastlabs.com.au,https://eastcoastlabs.com.au";
  return new Set(
    configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function trustedClientAddress(req: Request): string | null {
  const configured = process.env.CREATOR_TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  const trusted = new Set(["x-vercel-forwarded-for", "cf-connecting-ip", "true-client-ip"]);
  if (process.env.NODE_ENV === "test") trusted.add("x-ecl-client-ip");
  const header = configured || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "");
  if (header && !trusted.has(header)) return null;
  if (!header) return null;
  const value = req.headers.get(header)?.trim();
  if (!value || value.length > 128 || /[\r\n]/.test(value)) return null;
  return value;
}

async function readBoundedJson(req: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }
> {
  const length = req.headers.get("content-length");
  if (length && Number(length) > MAX_BYTES) return { ok: false, status: 413 };
  const reader = req.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    await reader.cancel().catch(() => {});
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400 };
  }
}

function secondsToNextHour(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(60, 0, 0);
  return String(Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000)));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin")?.trim();
  if (!origin || !allowedOrigins().has(origin)) return noStore({ ok: false, code: "invalid_request" }, { status: 400 });

  const contentType = req.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return noStore({ ok: false, code: "invalid_request" }, { status: 400 });
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
  if (!UUID_RE.test(idempotencyKey)) {
    return noStore({ ok: false, code: "invalid_request" }, { status: 400 });
  }

  const clientAddress = trustedClientAddress(req);
  if (!clientAddress) return noStore({ ok: false, code: "unavailable" }, { status: 503 });

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return noStore({ ok: false, code: "invalid_request" }, { status: parsed.status });

  const validation = validateCreatorInput(parsed.value);
  if (!validation.ok) {
    return noStore(
      { ok: false, code: "validation", fieldErrors: validation.fieldErrors },
      { status: 422 },
    );
  }

  const result = await submitCreatorApplication(validation.value, { idempotencyKey, clientAddress });
  if (result.ok) return noStore({ ok: true });
  if (result.code === "conflict") return noStore({ ok: false, code: "conflict" }, { status: 409 });
  if (result.code === "rate_limited") {
    return noStore(
      { ok: false, code: "rate_limited" },
      { status: 429, headers: { "retry-after": secondsToNextHour() } },
    );
  }
  if (result.code === "validation") return noStore(result, { status: 422 });
  if (result.code === "invalid_request") {
    return noStore({ ok: false, code: "invalid_request" }, { status: 400 });
  }
  return noStore({ ok: false, code: "unavailable" }, { status: 503 });
}
