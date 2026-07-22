"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Adds `is-visible` to its element the first time it
 * enters the viewport, which triggers the CSS reveal animation. Pair with a
 * `reveal` class (element animates itself) or `stagger` class (children animate
 * in sequence). Degrades to visible immediately when IntersectionObserver is
 * unavailable, and the CSS honours prefers-reduced-motion.
 */
export default function Reveal({
  children,
  className = "",
  threshold = 0.12,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={`${className} ${visible ? "is-visible" : ""}`}>
      {children}
    </div>
  );
}
