import {expect,it,vi} from 'vitest';
import {renderTemplate} from '@/lib/email/templates';
it('offers delivery help and an unconditional secure review link in the same completion email',async()=>{
 vi.stubEnv('ORDER_ACCESS_SECRET','test-only-order-secret-more-than-32-characters');
 const {html}=await renderTemplate('post_purchase_review',{order_id:'31a1e654-4577-4176-99d8-255613de2911',order_number:'ECL-TEST'});
 expect(html).toMatch(/Did everything arrive OK/i);
 expect(html).toMatch(/mailto:/);
 expect(html).toMatch(/missing|damaged/);
 expect(html).toMatch(/leave-a-review\?token=v1\./);
 expect(html).toContain('Leave a review');
});
it('escapes tracking values in shipping email HTML',async()=>{
 const {html}=await renderTemplate('order_shipped',{order_number:'ECL-TEST',tracking_number:'<b>parcel</b>'});
 expect(html).not.toContain('<b>parcel</b>');expect(html).toContain('&lt;b&gt;parcel&lt;/b&gt;');
});
