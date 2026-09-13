import { getOrderAttribution, storeExperimentAssignment, type ExperimentAssignment } from "./attribution";

export type Variant = "control" | "v1";
export interface WeightedVariant { id: string; weight: number }
export interface ExperimentConfig { id: string; active: boolean; variants: readonly WeightedVariant[] }

/** Route presentation is not randomization. This remains inactive until the
 * operator explicitly enables an eligible-traffic plan outside the release. */
export const HOMEPAGE_EXPERIMENT: ExperimentConfig = {
  id: "homepage-2026q3",
  active: process.env.NEXT_PUBLIC_HOMEPAGE_EXPERIMENT_ACTIVE === "1",
  variants: [{ id: "control", weight: 1 }, { id: "v1", weight: 1 }],
};

const IDENTIFIER = /^[a-z0-9][a-z0-9._~-]{0,63}$/;
function valid(config: ExperimentConfig) {
  return config.active && IDENTIFIER.test(config.id) && config.variants.length >= 2 && config.variants.length <= 8
    && config.variants.every((variant, index) => IDENTIFIER.test(variant.id) && Number.isSafeInteger(variant.weight) && variant.weight > 0
      && config.variants.findIndex((other) => other.id === variant.id) === index);
}

/** Pure deterministic allocation primitive for a predeclared eligible subject.
 * It does not inspect routes, email or other personal data. */
export function stableExperimentVariant(config: ExperimentConfig, anonymousSubject: string): string | null {
  if (!valid(config) || !IDENTIFIER.test(anonymousSubject) || anonymousSubject.length > 64) return null;
  let hash = 2166136261;
  for (const char of `${config.id}:${anonymousSubject}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  const total = config.variants.reduce((sum, variant) => sum + variant.weight, 0);
  let bucket = (hash >>> 0) % total;
  for (const variant of config.variants) { if (bucket < variant.weight) return variant.id; bucket -= variant.weight; }
  return null;
}

/** Persists an assignment that an approved allocator has already made.
 * First assignment wins; passing a page's route arm does not imply randomization. */
export function recordExperimentAssignment(config: ExperimentConfig, variant: string): ExperimentAssignment | null {
  if (!valid(config) || !config.variants.some((candidate) => candidate.id === variant)) return null;
  return storeExperimentAssignment({ experimentId: config.id, variant });
}
export function getExperimentAssignments(): ExperimentAssignment[] { return getOrderAttribution()?.experiments ?? []; }

/** Compatibility for the existing route marker. The homepage experiment is
 * inactive by default and this merely records an externally allocated exposure. */
export function ensureVariant(variant: Variant): Variant {
  return (recordExperimentAssignment(HOMEPAGE_EXPERIMENT, variant)?.variant as Variant | undefined) ?? variant;
}
export function getVariant(): Variant | null {
  const value=getExperimentAssignments().find((entry)=>entry.experimentId===HOMEPAGE_EXPERIMENT.id)?.variant;
  return value === "control" || value === "v1" ? value : null;
}
