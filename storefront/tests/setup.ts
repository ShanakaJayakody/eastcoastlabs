import { afterEach, beforeEach, vi } from "vitest";

// Tests must never inherit a developer's production credentials. Explicitly
// stub the boundary in each test that needs a database/provider response.
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL", "DATABASE_URL", "RESEND_API_KEY", "CRON_SECRET", "ORDER_ACCESS_SECRET", "UNSUBSCRIBE_SECRET", "RESEND_WEBHOOK_SECRET", "GA4_API_SECRET", "NEXT_PUBLIC_GA4_ID",
]) delete process.env[key];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("Unexpected network request: tests must use an isolated database or an explicit provider fake.");
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
