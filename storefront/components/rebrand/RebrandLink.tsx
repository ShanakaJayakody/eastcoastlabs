'use client';

import Link from 'next/link';
import { Suspense, type ComponentProps } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { parseRebrandVariant, rebrandHref } from '@/lib/rebrand-imagery';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

function ActiveLink({ href, ...props }: Props) {
  const pathname = usePathname();
  const query = useSearchParams();
  const landing = pathname?.match(/^\/([123])$/)?.[1];
  const variant = parseRebrandVariant(query?.get('rebrand'))
    ?? parseRebrandVariant(landing ? `v${landing}` : undefined);
  const destination = /^\/(shop(?:[?#]|$)|product\/)/.test(href)
    ? rebrandHref(href, variant) : href;
  return <Link {...props} href={destination} />;
}

/** Shared commerce navigation follows the explicit design, without a cookie. */
export default function RebrandLink(props: Props) {
  return <Suspense fallback={<Link {...props} />}><ActiveLink {...props} /></Suspense>;
}
