"use client";
import { usePathname } from 'next/navigation';
import type {ReactNode} from 'react';
/** Transaction and access-token flows never show newsletter capture. */
export default function MarketingOnly({children}:{children:ReactNode}) {
  const pathname=usePathname();
  if (/^\/(checkout|pay|cart|leave-a-review|admin|subscribe|subscribe-confirm|unsubscribe)(\/|$)/.test(pathname)) return null;
  return children;
}
