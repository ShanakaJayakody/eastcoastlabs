"use client";

import { useEffect, useRef } from "react";

/**
 * Counts a number up from 0 exactly once when it scrolls into view. SSR
 * renders the final value directly (no hydration mismatch); this only
 * imperatively rewrites textContent post-mount, and skips entirely under
 * prefers-reduced-motion.
 */
export default function CountUp({
  value,
  decimals = 2,
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const duration = 600;
        const start = performance.now();
        function tick(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          if (el) el.textContent = `${(eased * value).toFixed(decimals)}${suffix}`;
          if (t < 1) requestAnimationFrame(tick);
          else if (el) el.textContent = `${value.toFixed(decimals)}${suffix}`;
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className={`count-up ${className}`}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
