"use client";

import type { ReactNode } from "react";
import { trackCreatorEvent, type CreatorPlacement } from "@/lib/analytics";

export default function CreatorCtaLink({
  href,
  placement,
  className,
  children,
}: {
  href: string;
  placement: CreatorPlacement;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackCreatorEvent("creator_cta_click", { placement })}
    >
      {children}
    </a>
  );
}
