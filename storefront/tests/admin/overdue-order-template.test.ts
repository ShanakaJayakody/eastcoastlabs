import { expect, it, vi } from 'vitest';
vi.mock('@/lib/settings', () => ({ getSettings: async () => ({ supportEmail: 'support@example.test' }) }));
import { renderTemplate } from '@/lib/email/templates';
import type { EmailTemplate } from '@/lib/admin/email';

it.each([
  { queue: 'awaiting_payment', label: 'Awaiting payment', action: /confirm.*payment/i },
  { queue: 'to_fulfil', label: 'To fulfil', action: /pack and dispatch/i },
])('renders actionable priority alerts for $queue', async ({ queue, label, action }) => {
  const email = await renderTemplate('admin_order_overdue' as EmailTemplate, {
    order_id: '00000000-0000-0000-0000-000000000001', order_number: 'ECL-1042', queue,
    customer_name: '<img src=x onerror=alert(1)>', amount_cents: 24900, hours_waiting: 25,
  });
  expect(email.subject).toContain('[PRIORITY]');
  expect(email.subject).toContain('ECL-1042');
  expect(email.html).toContain(label);
  expect(email.html).toContain('25 hours');
  expect(email.html).toMatch(action);
  expect(email.html).toContain('https://www.eastcoastlabs.com.au/admin/orders/00000000-0000-0000-0000-000000000001');
  expect(email.html).not.toContain('<img src=x');
  expect(email.html).not.toContain('Unsubscribe');
});
