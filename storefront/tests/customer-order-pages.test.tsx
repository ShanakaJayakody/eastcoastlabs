import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import OrderReceipt from '@/components/customer-orders/OrderReceipt';
import {presentOrder} from '@/lib/customer-orders/presentation';
const raw={id:'10000000-0000-0000-0000-000000000001',order_number:'ECL-9000',status:'shipped',created_at:'2026-09-27T00:00:00Z',shipped_at:'2026-09-29T00:00:00Z',customer_email:'buyer@example.test',shipping_address:{line1:'Private street',city:'Melbourne'},carrier_code:'auspost',tracking_number:'TRACK123',subtotal_cents:5900,discount_cents:900,shipping_cents:1000,total_cents:6000,refunded_cents:1000,order_items:[{id:'i',product_name:'GHK-Cu',variant_label:'1 vial',size_label_snapshot:'50 mg',qty:2,refunded_qty:1,line_total_cents:5900,discount_allocated_cents:900,image_url_snapshot:'/images/products/ghk-cu-50mg-labelled.webp'}]};
it('shows photographs, exact size, quantity, paid amount, refunds and real tracking for a guest',()=>{
 const html=renderToStaticMarkup(<OrderReceipt order={presentOrder(raw,false)}/>);
 expect(html).toContain('GHK-Cu');expect(html).toContain('50 mg');expect(html).toContain('Quantity 2');expect(html).toContain('Refunded');expect(html).toContain('$50.00');expect(html).toContain('https://auspost.com.au/');expect(html).not.toContain('Private street');expect(html).not.toContain('buyer@example.test');expect(html).not.toContain('Expected delivery');
});
it('shows personal details only on the verified owner projection',()=>{
 const html=renderToStaticMarkup(<OrderReceipt order={presentOrder(raw,true)}/>);
 expect(html).toContain('Private street');expect(html).toContain('buyer@example.test');
});
it('keeps a text fallback when photos are absent and labels gift lines',()=>{
 const order=presentOrder({...raw,order_items:[{...raw.order_items[0],image_url_snapshot:null,variant_label:'Free gift',line_total_cents:0,discount_allocated_cents:0}]},false);
 const html=renderToStaticMarkup(<OrderReceipt order={order}/>);expect(html).toContain('GHK-Cu');expect(html).toContain('Free gift');expect(html).toContain('$0.00');
});
