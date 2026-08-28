"use client";

import type { ReactNode } from "react";
import { CartProvider, type CartThresholds } from "@/lib/cart-context";
import { UIProvider } from "@/lib/ui-context";

export default function Providers({
  children,
  thresholds,
  stock,
}: {
  children: ReactNode;
  /** Resolved server-side from admin settings by the layout. Omitted → the
   *  cart falls back to the build-time defaults in lib/env.ts. */
  thresholds?: CartThresholds;
  /** Live availability per slug (bac water + accessories), from the layout. */
  stock?: Record<string, number>;
}) {
  return (
    <CartProvider thresholds={thresholds} stock={stock}>
      <UIProvider>{children}</UIProvider>
    </CartProvider>
  );
}
