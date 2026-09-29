// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings', () => ({ getSettings: async () => ({
  supportEmail: 'help@example.test', supportHours: 'Mon–Fri, 9am–5pm AEST',
  freeShippingThreshold: 150, payidEnabled: true, payidIdentifier: 'payments@example.test',
  payidName: 'East Coast Labs', bankTransferEnabled: false,
  paymentWindowHours: 24, paymentExpiryHours: 48,
}) }));

import { renderTemplate } from '@/lib/email/templates';
import { ALL_TEMPLATES, MARKETING_TEMPLATES, samplePayload } from '@/lib/email/samples';

beforeEach(() => vi.stubEnv('ORDER_ACCESS_SECRET', 'email-preview-only-secret-longer-than-32-characters'));

// Missing the shared footer in any branch leaves customers without a support route.
it.each(ALL_TEMPLATES.filter(t => !t.id.startsWith('admin_')))('$id includes working support and the appropriate unsubscribe action', async ({ id }) => {
  const email = await renderTemplate(id, samplePayload(id));
  const doc = new DOMParser().parseFromString(email.html, 'text/html');
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  expect(doc.querySelector('a[href="mailto:help@example.test"]')?.textContent).toContain('help@example.test');
  expect(doc.body.textContent).toContain('Research use only');
  const unsubscribe = Array.from(doc.querySelectorAll('a')).find(a => /unsubscribe/i.test(a.textContent ?? ''));
  expect(Boolean(unsubscribe)).toBe(MARKETING_TEMPLATES.includes(id));
  if (unsubscribe) expect(unsubscribe.href).toBe(samplePayload(id).unsubscribe_url);
  expect(doc.querySelector('script, link[rel="stylesheet"]')).toBeNull();
});

// Payloads must remain visible text, never turn into elements or change links.
it.each(['order_confirmation', 'order_shipped', 'order_refunded', 'payment_instructions', 'back_in_stock'] as const)('%s escapes customer-visible payload fields', async id => {
  const hostile = '<img src=x onerror="alert(1)">';
  const email = await renderTemplate(id, { ...samplePayload(id), order_number: hostile, product_name: hostile, variant_label: hostile, tracking_number: hostile });
  const doc = new DOMParser().parseFromString(email.html, 'text/html');
  expect(doc.querySelector('img[src="x"], [onerror]')).toBeNull();
  expect(doc.body.textContent).toContain(hostile);
});

it.each(ALL_TEMPLATES)('$id uses the revamped logo with a readable text identity', async ({ id }) => {
  const email = await renderTemplate(id, samplePayload(id));
  const doc = new DOMParser().parseFromString(email.html, 'text/html');
  const logos = doc.querySelectorAll('img');
  expect(logos).toHaveLength(1);
  expect(logos[0].getAttribute('src')).toBe('https://www.eastcoastlabs.com.au/brand/ecl-cobalt-symbol.png');
  expect(logos[0].getAttribute('alt')).toBe('East Coast Labs');
  expect(doc.body.textContent).toContain('EAST COAST LABS');
});

it('keeps the exact payment amount, reference and configured destination readable', async () => {
  const email = await renderTemplate('payment_instructions', { ...samplePayload('payment_instructions'), amount_cents: 12345, reference: 'ECL-TEST-987' });
  const doc = new DOMParser().parseFromString(email.html, 'text/html');
  expect(doc.body.textContent).toContain('$123.45');
  expect(doc.body.textContent).toContain('ECL-TEST-987');
  expect(doc.body.textContent).toContain('payments@example.test');
  expect(doc.querySelector('a[href*="/pay/"]')).not.toBeNull();
});

it('falls back to the catalogue when a stock notification has an invalid product path', async () => {
  const email = await renderTemplate('back_in_stock', { ...samplePayload('back_in_stock'), url: '/shop" onclick="alert(1)' });
  const doc = new DOMParser().parseFromString(email.html, 'text/html');
  expect(doc.querySelector('[onclick]')).toBeNull();
  expect(doc.querySelector('a[href="https://www.eastcoastlabs.com.au/shop"]')).not.toBeNull();
});
