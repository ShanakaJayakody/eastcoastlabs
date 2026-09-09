import { describe, expect, it, vi } from "vitest";
const { run } = vi.hoisted(() => ({ run: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/cron-runs", () => ({ recordCronRun: run }));
vi.mock("@/lib/email/sender", () => ({ drainOutbox: vi.fn() }));
vi.mock("@/lib/admin/payment-ops", () => ({ remindUnpaidOrders: vi.fn(), warnExpiringOrders: vi.fn(), expireUnpaidOrders: vi.fn() }));
vi.mock("@/lib/admin/cart-recovery", () => ({ queueAbandonedCartEmails: vi.fn() }));
vi.mock("@/lib/admin/lifecycle", () => ({ sweepWelcomeSeries: vi.fn(), sweepPostPurchase: vi.fn(), sweepReviewThankYou: vi.fn(), sweepReplenishment: vi.fn(), sweepWinback: vi.fn(), sweepSecondPurchaseNudge: vi.fn() }));
vi.mock("@/lib/admin/orders", () => ({ completeDeliveredOrders: vi.fn() }));

const routes = [
  () => import("@/app/api/cron/email-outbox/route"),
  () => import("@/app/api/cron/payment-ops/route"),
  () => import("@/app/api/cron/abandoned-carts/route"),
  () => import("@/app/api/cron/lifecycle/route"),
];

describe.each(routes.map((load, i) => ({ load, i })))("cron endpoint $i", ({ load }) => {
  it("refuses missing configuration without starting any job", async () => {
    run.mockClear(); vi.stubEnv("CRON_SECRET", "");
    const response = await (await load()).GET(new Request("https://example.test/api/cron"));
    expect(response.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });
  it("refuses a wrong bearer and allows the configured bearer", async () => {
    run.mockClear(); vi.stubEnv("CRON_SECRET", "test-unique-cron-secret");
    const { GET } = await load();
    expect((await GET(new Request("https://example.test/api/cron", { headers: { authorization: "Bearer incorrect" } }))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect((await GET(new Request("https://example.test/api/cron", { headers: { authorization: "Bearer test-unique-cron-secret" } }))).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
