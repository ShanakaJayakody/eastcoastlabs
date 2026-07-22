"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { UIProvider } from "@/lib/ui-context";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <UIProvider>{children}</UIProvider>
    </CartProvider>
  );
}
