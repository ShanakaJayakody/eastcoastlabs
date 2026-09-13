"use client";

import { useEffect, useRef } from "react";
import { trackExperimentImpression } from "@/lib/analytics";
import { ANALYTICS_CONSENT_EVENT, analyticsConsent } from "@/lib/attribution";
import { HOMEPAGE_EXPERIMENT, recordExperimentAssignment, type Variant } from "@/lib/variant";

/**
 * Stamps the first-touch variant cookie and reports one GA4 impression when a
 * landing page mounts. Renders nothing. Safe no-op without GA4 configured —
 * though the cookie is still written, since attribution has to survive whether
 * or not analytics is switched on.
 *
 * The ref guard keeps this to a single fire under React StrictMode's
 * double-invoked effects in dev, mirroring ViewItemTracker.
 */
export default function VariantTag({ variant }: { variant: Variant }) {
  const fired = useRef(false);
  useEffect(() => {
    const track = () => {
      if (fired.current || analyticsConsent() !== "granted") return;
      // `/` and `/1` are route choices, not random allocation. They are only
      // measured as an experiment after an operator explicitly activates the
      // predeclared eligible-traffic plan.
      const assignment = recordExperimentAssignment(HOMEPAGE_EXPERIMENT, variant);
      if (!assignment) return;
      trackExperimentImpression(assignment.experimentId, assignment.variant as Variant);
      fired.current = true;
    };
    track();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, track);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, track);
  }, [variant]);
  return null;
}
