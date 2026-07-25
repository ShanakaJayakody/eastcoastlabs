"use client";

import { useEffect, useRef } from "react";
import { trackExperimentImpression } from "@/lib/analytics";
import { ensureVariant, type Variant } from "@/lib/variant";

/** The split test this component attributes traffic to. */
const EXPERIMENT_ID = "homepage_2026q3";

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
    if (fired.current) return;
    fired.current = true;
    // Resolve before reporting: an earlier first touch outranks this page's own
    // arm, so the impression must report where the visitor is actually
    // attributed, not which page they happen to be looking at.
    const resolved = ensureVariant(variant);
    trackExperimentImpression(EXPERIMENT_ID, resolved);
  }, [variant]);
  return null;
}
