import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('@/lib/settings',()=>({getSettings:async()=>({supportEmail:'help@eastcoastlabs.com.au',supportHours:'Weekdays',freeShippingThreshold:250,paymentExpiryHours:72,paymentWindowHours:48,bankBsb:'123456',bankAccountNumber:'12345678',bankAccountName:'East Coast Labs'})}));
import {renderTemplate} from '@/lib/email/templates';
const id='10000000-0000-0000-0000-000000000001';
export const summary={order_id:id,order_number:'ECL-1234',access_version:1,created_at:'2026-09-30',status:'shipped',carrier_code:'auspost',tracking_number:'TRACK-123',subtotal_cents:5900,discount_cents:900,shipping_cents:1000,total_cents:6000,refunded_cents:0,currency:'AUD',items:[{id:'line-1',name:'GHK-Cu <50>',size_label:'50 mg',variant_label:'1 vial',qty:2,refunded_qty:0,line_total_cents:5900,discount_cents:900,image_url:'/images/products/a.jpg',image_alt:'50 mg vial',is_gift:false}]};
const payload={order_id:id,order_number:'ECL-1234',amount_cents:6000,order_summary_v1:summary};
beforeEach(()=>{vi.stubEnv('CUSTOMER_ORDER_EMAILS_ENABLED','1');vi.stubEnv('ORDER_ACCESS_SECRET','k'.repeat(32));});
it('renders the purchased images, sizes, amounts and private order CTA with text alternative',async()=>{
 const r=await renderTemplate('order_shipped',payload);
 expect(r.html).toContain('View your order');expect(r.html).toContain('/orders/access?token=');expect(r.html).toContain('GHK-Cu &lt;50&gt;');expect(r.html).toContain('50 mg');expect(r.html).toContain('https://www.eastcoastlabs.com.au/images/products/a.jpg');expect(r.html).toContain('$50.00');expect(r.html).toContain('auspost.com.au');expect(r.text).toContain('Quantity 2');expect(r.replyTo).toBe('help@eastcoastlabs.com.au');
});
it('keeps image-blocked messages useful and refuses external image URLs and unsupported WebP email assets',async()=>{
 const r=await renderTemplate('order_confirmation',{...payload,order_summary_v1:{...summary,items:[{...summary.items[0],image_url:'https://evil.test/pixel.jpg'},{...summary.items[0],id:'two',image_url:'/images/products/a.webp'}]}});
 expect(r.html).not.toContain('evil.test');expect(r.html).not.toContain('a.webp');expect(r.html).toContain('Quantity 2');
});
it('bounds long receipts, links remaining lines and never attaches an unrelated summary',async()=>{
 const r=await renderTemplate('order_confirmation',{...payload,order_summary_v1:{...summary,items:Array.from({length:100},(_,i)=>({...summary.items[0],id:`i-${i}`,name:'Long product name '.repeat(30)}))}});
 expect(Buffer.byteLength(r.html)).toBeLessThan(90000);expect(r.html).toContain('View all 100 items');
 const unrelated=await renderTemplate('order_confirmation',{...payload,order_id:'20000000-0000-0000-0000-000000000002'});expect(unrelated.html).not.toContain('/orders/access');
});
it('preserves legacy templates without a snapshot or with rollout disabled',async()=>{
 const old=await renderTemplate('order_confirmation',{order_id:id,order_number:'ECL-1234'});expect(old.html).not.toContain('/orders/access');expect(old.text).toBeUndefined();
 vi.stubEnv('CUSTOMER_ORDER_EMAILS_ENABLED','');const off=await renderTemplate('order_shipped',payload);expect(off.html).not.toContain('/orders/access');
});
it('initial unpaid email shows the stored absolute deadline even when rendered late under changed settings',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T04:00:00Z'));
 try {
  const r=await renderTemplate('payment_instructions',{...payload,payment_expires_at:'2026-09-30T06:00:00Z',payment_method:'bank_transfer'});
  expect(r.html).toContain('30 Sept 2026');expect(r.text).toContain('4:00 pm AEST');expect(r.text).not.toContain('after 72 hours');expect(r.html).toContain('reservation ends');
 } finally {vi.useRealTimers();}
});
