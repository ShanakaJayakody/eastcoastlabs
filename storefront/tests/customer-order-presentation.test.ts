import { expect, it } from 'vitest';
import { customerStatus, trackingLink, receiptImageUrl, presentOrder } from '@/lib/customer-orders/presentation';
it('stops requesting payment at the reservation deadline and never fabricates delivery',()=>{
 expect(customerStatus({status:'pending',payment_expires_at:'2026-09-30T00:00:00Z'},Date.parse('2026-09-30T00:00:00Z'))).toEqual({label:'Reservation expired',showPayment:false});
 expect(customerStatus({status:'completed',payment_expires_at:null},0).label).toBe('Order completed');
});
it('constructs links only for explicit carriers and rejects non-product image origins',()=>{
 expect(trackingLink(null,'123')).toBeNull();
 expect(trackingLink('auspost','A B')).toBe('https://auspost.com.au/mypost/track/#/details/A%20B');
 expect(receiptImageUrl('https://evil.example/receipt.png')).toBeNull();
 expect(receiptImageUrl('//evil.example/p.png')).toBeNull();
 expect(receiptImageUrl('/images/products/vial.png')).toBe('https://www.eastcoastlabs.com.au/images/products/vial.png');
});
it('redacts personal/internal facts and uses paid line amounts rather than catalogue pricing',()=>{
 const order={id:'a',order_number:'ECL-1',status:'paid',created_at:'2026-09-30',customer_email:'buyer@example.test',customer_name:'Buyer',shipping_address:{address1:'Private street'},notes:'Staff secret',subtotal_cents:1000,discount_cents:100,shipping_cents:500,total_cents:1400,refunded_cents:0,order_items:[{id:'b',product_name:'Item',variant_label:'1 vial',qty:1,line_total_cents:1000,discount_allocated_cents:100,refunded_qty:0}]};
 const guest=presentOrder(order,false,0);
 expect(guest.privateDetails).toBeNull();expect(JSON.stringify(guest)).not.toMatch(/Private street|buyer@|Staff secret/);
 expect(guest.items[0].lineTotalCents).toBe(900);
 expect(presentOrder(order,true,0).privateDetails?.email).toBe('buyer@example.test');
});
