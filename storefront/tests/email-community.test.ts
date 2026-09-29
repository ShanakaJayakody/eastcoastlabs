// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/settings')>();
  return { ...original, getSettings: async () => ({
    ...original.DEFAULT_SETTINGS, supportEmail: 'help@example.test',
    payidIdentifier: 'payments@example.test', payidName: 'East Coast Labs',
    paymentWindowHours: 24, paymentExpiryHours: 48,
  }) };
});
import { renderTemplate } from '@/lib/email/templates';
import { ALL_TEMPLATES, samplePayload } from '@/lib/email/samples';

const telegram = 'https://t.me/eclpeptides';
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const communityLink = (doc: Document) => Array.from(doc.querySelectorAll('a'))
  .find(link => /join.*telegram/i.test(link.textContent ?? ''));

beforeEach(() => {
  vi.stubEnv('ORDER_ACCESS_SECRET', 'email-copy-test-secret-more-than-32-characters');
  vi.stubEnv('CUSTOMER_ORDER_EMAILS_ENABLED', '');
});

// A missed shell branch would leave some customers without the promised support route.
it.each(ALL_TEMPLATES.filter(t => !t.id.startsWith('admin_')))
  ('$id offers the fixed Telegram support destination alongside email support', async ({id}) => {
    const result = await renderTemplate(id, {...samplePayload(id), telegram_url: 'https://evil.test'});
    const doc = parse(result.html);
    const support = Array.from(doc.querySelectorAll('a')).find(a => a.textContent === '@eclpeptides');
    expect(support?.getAttribute('href')).toBe(telegram);
    expect(doc.querySelector('a[href="mailto:help@example.test"]')).not.toBeNull();
    expect(doc.querySelector('a[href="https://evil.test"]')).toBeNull();
    expect(doc.body.textContent).toContain('24/7 support');
    expect(doc.body.textContent).toContain('Response times may vary');
  });

// Only a general marketing subscription earns the promotional community invitation.
it.each(['welcome_1','welcome_3','arrival_checkin','post_purchase_review','review_thank_you',
  'replenishment','second_purchase_nudge','winback_60','winback_90'] as const)
  ('%s includes the community invitation without replacing unsubscribe', async template => {
    const payload = samplePayload(template);
    const doc = parse((await renderTemplate(template, payload)).html);
    expect(communityLink(doc)?.getAttribute('href')).toBe(telegram);
    expect(doc.querySelector(`a[href="${payload.unsubscribe_url}"]`)).not.toBeNull();
  });

it.each(['payment_instructions','payment_reminder','payment_expiring','payment_expired',
  'order_confirmation','order_shipped','order_refunded','subscription_confirmation',
  'cart_recovery_confirmation','abandoned_cart','abandoned_cart_2','abandoned_cart_3',
  'back_in_stock','post_purchase_review_reminder'] as const)
  ('%s keeps Telegram support but does not add a broader promotional invitation', async template => {
    const doc = parse((await renderTemplate(template, samplePayload(template))).html);
    expect(doc.querySelector(`a[href="${telegram}"]`)).not.toBeNull();
    expect(communityLink(doc)).toBeUndefined();
  });

it.each(['admin_daily_brief','admin_order_overdue'] as const)
  ('%s stays an internal operational email', async template => {
    const doc = parse((await renderTemplate(template, samplePayload(template))).html);
    expect(doc.querySelector(`a[href="${telegram}"]`)).toBeNull();
  });

it('keeps Telegram, receipt details and scoped order access in the enriched plain-text version', async () => {
  vi.stubEnv('CUSTOMER_ORDER_EMAILS_ENABLED', '1');
  const result = await renderTemplate('order_shipped', samplePayload('order_shipped'));
  const doc = parse(result.html);
  expect(result.text).toContain(telegram);
  expect(result.text).toContain('50 mg');
  expect(result.text).toContain('100 mg');
  expect(result.text).toContain('/orders/access?token=');
  expect(result.replyTo).toBe('help@example.test');
  expect(doc.querySelector('table[aria-label="Purchased items"]')).not.toBeNull();
  expect(doc.querySelector('a[href*="auspost.com.au"]')).not.toBeNull();
});

it('uses the stored payment deadline even without receipt enrichment, not a fresh hold window', async () => {
  const result = await renderTemplate('payment_instructions', {
    ...samplePayload('payment_instructions'), payment_expires_at: '2026-10-01T02:00:00Z',
  });
  const doc = parse(result.html);
  expect(doc.body.textContent).toContain('1 Oct 2026');
  expect(doc.body.textContent).not.toMatch(/hold your order for 24 hours|after 48 hours/);
  expect(doc.body.textContent).toContain('payments@example.test');
  expect(doc.querySelector('a[href*="/pay/"]')).not.toBeNull();
});
