"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: visible before JS and with reduced motion. */
export default function EditorialMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (
      !root ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-entered", "true");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.06 },
    );
    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.setAttribute("data-awaiting", "true");
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="ecl-home">
      {children}
    </div>
  );
}
