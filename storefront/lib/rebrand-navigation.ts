import type { RebrandVariant } from '@/components/rebrand/content';

export function parseRebrandVariant(value: unknown): RebrandVariant | undefined {
  return value === 'v1' || value === 'v2' || value === 'v3' ? value : undefined;
}

export function rebrandImageVariant(src?: string): RebrandVariant | undefined {
  if (/^\/images\/products\/ghk-cu-(100|50)mg-labelled\.webp$/.test(src ?? '')) return 'v1';
  return parseRebrandVariant(src?.match(/^\/images\/rebrand\/vials\/(v[123])\//)?.[1]);
}

export function rebrandHref(href: string, variant?: RebrandVariant): string {
  if (!variant) return href;
  const url = new URL(href, 'https://www.eastcoastlabs.com.au');
  url.searchParams.set('rebrand', variant);
  return `${url.pathname}${url.search}${url.hash}`;
}
