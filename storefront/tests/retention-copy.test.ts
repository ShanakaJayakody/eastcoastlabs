import {expect,it,vi} from 'vitest';
vi.mock('@/lib/settings',()=>({getSettings:async()=>({supportEmail:'support@example.test'})}));
vi.mock('@/lib/order-access',()=>({createOrderAccessToken:()=> 'signed-test',paymentPath:()=>'/payment'}));
import {renderTemplate} from '@/lib/email/templates';
it('asks about arrival without claiming delivery or a delivery deadline from shipped_at',async()=>{const {html}=await renderTemplate('arrival_checkin',{order_number:'ECL-1'});expect(html).not.toMatch(/should be with you|landed as it should/);expect(html).toContain('shipped');});
it('requests honest review based on dispatch, never invented delivery evidence',async()=>{const {html}=await renderTemplate('post_purchase_review',{order_number:'ECL-1',order_id:'order'});expect(html).not.toContain('was delivered');expect(html).toContain('shipped');});
it('renders a neutral configured reorder reminder and only safe product links',async()=>{const {html,subject}=await renderTemplate('replenishment',{reminder_days:45,items:[{name:'Sample',qty:1,url:'/product/sample'},{name:'Other',qty:2,url:'https://evil.test'}]});expect(html).not.toMatch(/Running low|3 weeks|10 weeks|22 weeks|RESTOCK10/);expect(subject).not.toContain('10%');expect(html).toContain('href="https://www.eastcoastlabs.com.au/product/sample"');expect(html).not.toContain('href="https://evil.test"');});
