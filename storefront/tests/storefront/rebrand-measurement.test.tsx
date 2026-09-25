// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  ANALYTICS_CONSENT_COOKIE,
  MEASUREMENT_COOKIE,
  publicMeasurementPath,
  setAnalyticsConsent,
} from "@/lib/attribution";
import * as experiments from "@/lib/variant";
import VariantTag from "@/components/VariantTag";

const impression = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackExperimentImpression: impression }));
const active = {
  id: "rebrand-2026q3",
  active: true,
  variants: ["v1", "v2", "v3"].map((id) => ({ id, weight: 1 })),
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS", "rebrand-2026q3:v1|v2|v3");
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;
  document.cookie = `${MEASUREMENT_COOKIE}=; Max-Age=0; Path=/`;
  impression.mockClear();
});
afterEach(cleanup);

it("allows all three public design routes, without allowing arbitrary or private routes", () => {
  for (const path of ["/1", "/2", "/3", "/2/"])
    expect(publicMeasurementPath(path)).toBe(true);
  for (const path of ["/4", "/2/private", "/admin", "/3?email=private"])
    expect(publicMeasurementPath(path)).toBe(false);
});

it("keeps the new experiment separate and disabled by default", () => {
  expect(experiments).toHaveProperty("REBRAND_EXPERIMENT");
  const config = Reflect.get(experiments, "REBRAND_EXPERIMENT");
  expect(config).toMatchObject({ id: "rebrand-2026q3", active: false });
  expect(config.id).not.toBe(experiments.HOMEPAGE_EXPERIMENT.id);
  expect(experiments.recordExperimentAssignment(config, "v2")).toBeNull();
});

it("records the viewed rebrand only after consent, once, with the new experiment identity", async () => {
  render(
    <VariantTag
      variant={"v2" as experiments.Variant}
      {...{ experiment: active }}
    />,
  );
  expect(impression).not.toHaveBeenCalled();
  expect(document.cookie).not.toContain(MEASUREMENT_COOKIE);
  setAnalyticsConsent("granted");
  await waitFor(() =>
    expect(impression).toHaveBeenCalledWith("rebrand-2026q3", "v2"),
  );
  setAnalyticsConsent("granted");
  expect(impression).toHaveBeenCalledTimes(1);
  expect(experiments.getExperimentAssignments()).toEqual([
    { experimentId: "rebrand-2026q3", variant: "v2" },
  ]);
});

it("does not label a different design as an impression of the first assigned arm", async () => {
  setAnalyticsConsent("granted");
  experiments.recordExperimentAssignment(active, "v1");
  render(
    <VariantTag
      variant={"v3" as experiments.Variant}
      {...{ experiment: active }}
    />,
  );
  await Promise.resolve();
  expect(impression).not.toHaveBeenCalled();
  expect(experiments.getExperimentAssignments()).toEqual([
    { experimentId: "rebrand-2026q3", variant: "v1" },
  ]);
});
