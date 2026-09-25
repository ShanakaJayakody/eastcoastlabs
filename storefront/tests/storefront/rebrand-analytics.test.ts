// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ GA4_ID: "G-TEST" }));
vi.mock("@/lib/variant", () => ({
  getExperimentAssignments: () => [
    { experimentId: "homepage-2026q3", variant: "control" },
    { experimentId: "rebrand-2026q3", variant: "v2" },
  ],
}));
import { trackExperimentImpression, trackAddToCart } from "@/lib/analytics";
beforeEach(() => {
  history.replaceState({}, "", "/2");
  document.cookie = "ecl_analytics_consent=granted; Path=/";
  window.gtag = vi.fn();
});
it("keeps an older experiment from mislabelling the new impression", () => {
  trackExperimentImpression("rebrand-2026q3", "v2");
  expect(window.gtag).toHaveBeenCalledWith(
    "event",
    "experiment_impression",
    expect.objectContaining({
      experiment_id: "rebrand-2026q3",
      experiment_variant: "v2",
    }),
  );
});
it("retains rebrand attribution across the shared shopping funnel alongside the older experiment", () => {
  history.replaceState({}, "", "/product/ghk-cu");
  trackAddToCart({ item_id: "ghk-cu", item_name: "GHK-Cu" });
  expect(window.gtag).toHaveBeenCalledWith(
    "event",
    "add_to_cart",
    expect.objectContaining({
      experiment_id: "homepage-2026q3",
      experiment_variant: "control",
      rebrand_experiment_id: "rebrand-2026q3",
      rebrand_variant: "v2",
    }),
  );
});
