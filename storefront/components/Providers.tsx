"use client";

import type { ReactNode } from "react";
import { CartProvider, type CartThresholds } from "@/lib/cart-context";
import { UIProvider } from "@/lib/ui-context";

export default function Providers({
  children,
  thresholds,
}: {
  children: ReactNode;
  /** Resolved server-side from admin settings by the layout. Omitted → the
   *  cart falls back to the build-time defaults in lib/env.ts. */
  thresholds?: CartThresholds;
}) {
  return (
    <CartProvider thresholds={thresholds}>
      <UIProvider>{children}</UIProvider>
    </CartProvider>
  );
}
