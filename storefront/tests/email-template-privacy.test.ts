import { beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/settings',()=>({getSettings:async()=>({supportEmail:'support@example.test',bankTransferEnabled:false,freeShippingThreshold:150})}));
import { renderTemplate } from '@/lib/email/templates';
beforeEach(()=>vi.stubEnv('ORDER_ACCESS_SECRET','test-only-key-for-review-more-than-32-characters'));
const order_id='31a1e654-4577-4176-99d8-255613de2911';
it('replaces legacy review URLs with scoped links without email or predictable receipt fields',async()=>{
 for(const template of ['post_purchase_review','post_purchase_review_reminder'] as const) {
  const email=await renderTemplate(template,{order_id,order_number:'ECL-1',review_url:'https://example.test/?email=buyer@example.test&order=ECL-1'});
  expect(email.html).toContain('/leave-a-review?token=v1.');
  expect(email.html).not.toContain('buyer@example.test');expect(email.html).not.toContain('example.test/?');
 }
});
it('payment reminder copy uses the fixed deadline instead of queue-time hours remaining',async()=>{
 const email=await renderTemplate('payment_expiring',{order_id,order_number:'ECL-1',payment_expires_at:'2026-09-10T02:00:00Z',hours_left:20,amount_cents:1000});
 expect(email.html).not.toContain('20 more hours');expect(email.subject).not.toContain('in 20 hours');
 expect(email.html).toContain('10 Sept');
});
it('every recovery email uses the same opaque private restore link and no arbitrary destination',async()=>{
 for(const template of ['cart_recovery_confirmation','abandoned_cart','abandoned_cart_2','abandoned_cart_3'] as const) {
  const email=await renderTemplate(template,{recovery_request_id:order_id,recovery_episode_id:order_id,restore_url:'https://evil.test',cart:[{name:'<script>bad</script>',quantity:1}]});
  expect(email.html).toMatch(/https:\/\/www.eastcoastlabs.com.au\/cart-recovery\?token=[A-Za-z0-9_-]{43}/);
  expect(email.html).not.toContain('https://evil.test');expect(email.html).not.toContain('<script>');
  expect(email.html).not.toContain(`${order_id}`);
 }
 await expect(renderTemplate('abandoned_cart',{})).rejects.toThrow();
});
