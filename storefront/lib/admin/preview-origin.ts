import { isReadOnlyPreview } from './preview-policy';

export function adminAuthOrigin(): string {
  if (isReadOnlyPreview()) {
    const host = process.env.VERCEL_URL ?? '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.vercel\.app$/i.test(host)) {
      throw new Error('A verified Vercel preview origin is required for sign-in.');
    }
    return `https://${host}`;
  }
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.eastcoastlabs.com.au').origin;
}
