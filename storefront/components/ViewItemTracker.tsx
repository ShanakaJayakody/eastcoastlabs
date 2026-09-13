"use client";

import { useEffect, useRef } from "react";
import { commerceItem, trackViewItem } from "@/lib/analytics";
import { ANALYTICS_CONSENT_EVENT, analyticsConsent } from "@/lib/attribution";

/** Fires GA4 view_item once when a PDP mounts. Safe no-op without GA4 configured. */
export default function ViewItemTracker({
  slug,
  name,
  price,
  size,
  pack,
}: {
  slug: string;
  name: string;
  price: number;
  size?: string;
  pack?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    const track = () => {
      if (fired.current || analyticsConsent() !== "granted") return;
      trackViewItem(commerceItem({ slug, name, price, size, pack }), price);
      fired.current = true;
    };
    track();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, track);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, track);
  }, [slug, name, price, size, pack]);
  return null;
}
