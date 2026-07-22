"use client";

import { useEffect, useRef } from "react";
import { trackViewItem } from "@/lib/analytics";

/** Fires GA4 view_item once when a PDP mounts. Safe no-op without GA4 configured. */
export default function ViewItemTracker({
  id,
  name,
  price,
}: {
  id: number;
  name: string;
  price: number;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackViewItem({ item_id: id, item_name: name, price }, price);
  }, [id, name, price]);
  return null;
}
