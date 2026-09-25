"use client";

import { useEffect, useRef } from "react";
import { trackExperimentImpression } from "@/lib/analytics";
import { ANALYTICS_CONSENT_EVENT, analyticsConsent } from "@/lib/attribution";
import { HOMEPAGE_EXPERIMENT, recordExperimentAssignment, type ExperimentConfig, type Variant } from "@/lib/variant";

/**
 * Records consented exposure only for an explicitly enabled experiment.
 * First assignment wins; viewing another design is not an impression of the
 * originally assigned design. Merely visiting a URL never enables a test.
 *
 * The ref guard keeps this to a single fire under React StrictMode's
 * double-invoked effects in dev, mirroring ViewItemTracker.
 */
export default function VariantTag({ variant, experiment = HOMEPAGE_EXPERIMENT }: { variant: Variant; experiment?: ExperimentConfig }) {
  const fired = useRef(false);
  useEffect(() => {
    const track = () => {
      if (fired.current || analyticsConsent() !== "granted") return;
      // `/` and `/1` are route choices, not random allocation. They are only
      // measured as an experiment after an operator explicitly activates the
      // predeclared eligible-traffic plan.
      const assignment = recordExperimentAssignment(experiment, variant);
      if (!assignment || assignment.variant !== variant) return;
      trackExperimentImpression(assignment.experimentId, assignment.variant as Variant);
      fired.current = true;
    };
    track();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, track);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, track);
  }, [variant, experiment]);
  return null;
}
