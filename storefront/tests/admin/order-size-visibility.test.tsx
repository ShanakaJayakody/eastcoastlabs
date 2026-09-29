// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';

const {adminDb}=vi.hoisted(()=>({adminDb:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/admin/db',()=>({adminDb}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({advanceStatus:vi.fn(),editItemQty:vi.fn(),removeItem:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/orders/fulfilment-actions',()=>({saveLotAssignments:vi.fn()}));

import OrderItemsPanel from '@/components/admin/OrderItemsPanel';
import PackingMode from '@/components/admin/PackingMode';
import LotPacking from '@/components/admin/LotPacking';
import PackingSlip from '@/components/admin/PackingSlip';
import {orderItemVariantIdentity} from '@/lib/admin/order-item-identity';
import {getOrder,type OrderDetail} from '@/lib/admin/order-queries';

afterEach(()=>{cleanup();vi.resetAllMocks()});

const item={
 id:'item',variant_id:'variant',product_name:'Retatrutide',product_slug:'retatrutide-20',variant_label:'3-pack',size_label:'20 mg',sku:'ECL-SIZE-20-3',
 unit_price_cents:40500,qty:1,line_total_cents:40500,refunded_qty:0,refunded_cents:0,
};

it('prefers an arbitrary order-time size over a later catalogue label',()=>{
 expect(orderItemVariantIdentity('3-pack · 10 mg/mL','20 mg/mL')).toEqual({sizeLabel:'10 mg/mL',detailLabel:'3-pack'});
});

it('leaves ordinary non-sized pack labels unchanged',()=>{
 expect(orderItemVariantIdentity('100 pack',null)).toEqual({sizeLabel:null,detailLabel:'100 pack'});
});

it('loads the ordered variant size when physical stock claims create a second variant relationship',async()=>{
 const order={id:'order',order_number:'ECL-1'};
 const orderItem={...item,size_label:undefined,product_variants:{products:{size_label:'20 mg'}}};
 adminDb.mockReturnValue({from:(table:string)=>{
  if(table==='orders')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:order,error:null})})})};
  if(table==='order_items')return {select:(columns:string)=>({eq:async()=>columns.includes('product_variants!order_items_variant_id_fkey(products(size_label))')
   ? {data:[orderItem],error:null}
   : {data:null,error:{code:'PGRST201',message:'More than one relationship found for order_items and product_variants'}}})};
  return {select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})};
 }});
 const result=await getOrder('order');
 expect(result?.items[0]?.size_label).toBe('20 mg');
 expect(result?.items[0]).not.toHaveProperty('product_variants');
});

it.each(['order_items','order_events'])('does not silently replace a failed %s query with an empty list',async failedTable=>{
 adminDb.mockReturnValue({from:(table:string)=>{
  if(table==='orders')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'order'},error:null})})})};
  const result=table===failedTable?{data:null,error:{message:'Database unavailable'}}:{data:[],error:null};
  return {select:()=>({eq:()=>table==='order_events'?{order:async()=>result}:Promise.resolve(result)})};
 }});
 await expect(getOrder('order')).rejects.toThrow('Database unavailable');
});

it('makes the ordered strength prominent while reviewing an order',()=>{
 render(<OrderItemsPanel orderId="order" status="paid" items={[item]} subtotalCents={40500} discountCents={0} discountCode={null} shippingCents={0} totalCents={40500}/>);
 const row=screen.getByRole('row');
 expect(row).toHaveTextContent('Retatrutide');
 expect(within(row).getByText('20 mg')).toHaveClass('font-bold');
 expect(row).toHaveTextContent('3-pack');
});

it('makes the ordered strength prominent in the packing checklist',()=>{
 render(<PackingMode order={{id:'order',orderNumber:'ECL-1',customerName:'Buyer',customerEmail:'buyer@example.test',address:null,totalCents:40500,notes:null,
  items:[{id:'item',productName:'Retatrutide',variantLabel:'3-pack',sizeLabel:'20 mg',sku:'ECL-SIZE-20-3',qty:1,refundedQty:0,lineTotalCents:40500}]}}
  nextId={null} position={1} total={1}/>);
 const pick=screen.getByRole('button',{name:/Retatrutide/});
 expect(within(pick).getByText('20 mg')).toHaveClass('font-bold');
 expect(pick).toHaveTextContent('3-pack');
});

it('makes the physical stock-pool strength prominent during fulfilment',()=>{
 render(<LotPacking fulfilment={{orderId:'order',editable:true,status:'paid',lines:[{itemId:'item',productName:'Retatrutide',variantLabel:'3-pack',poolId:'pool',poolName:'Retatrutide',requiredUnits:3,allocatedUnits:0,unallocatedUnits:3,allocations:[]}]}}
  catalog={{pools:[{id:'pool',name:'Retatrutide',sizeLabel:'20 mg',onHand:12}],lots:[],receipts:[],certificates:[]}}/>);
 const heading=screen.getByRole('heading',{level:4});
 expect(heading).toHaveTextContent('Retatrutide');
 expect(within(heading).getByText('20 mg')).toHaveClass('font-bold');
 expect(heading).toHaveTextContent('3-pack');
});

it('prints the ordered strength on the packing slip',()=>{
 const order={
  id:'order',order_number:'ECL-1',status:'paid',customer_email:'buyer@example.test',customer_name:'Buyer',shipping_address:{},
  subtotal_cents:40500,discount_cents:0,shipping_cents:0,total_cents:40500,discount_code:null,payment_method:null,payment_ref:null,
  tracking_number:null,notes:null,stock_settled:true,refunded_cents:0,created_at:'2026-09-30',paid_at:null,shipped_at:null,items:[item],events:[],
 } as OrderDetail;
 render(<PackingSlip order={order}/>);
 const row=screen.getAllByRole('row')[1];
 expect(row).toHaveTextContent('Retatrutide');
 expect(within(row).getByText('20 mg')).toHaveClass('font-bold');
 expect(row).toHaveTextContent('3-pack');
});
