import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({tables:{} as Record<string,Record<string,unknown>[]>,errorTable:'',errorCount:false}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{let rows=m.tables[table]??[];let head=false;const q={select:(_columns?:string,options?:{head?:boolean})=>{head=!!options?.head;return q;},in:(key:string,values:unknown[])=>{rows=rows.filter(r=>values.includes(r[key]));return q;},eq:(key:string,value:unknown)=>{rows=rows.filter(r=>r[key]===value);return q;},not:(key:string,_op:string,value:unknown)=>{rows=rows.filter(r=>r[key]!==value);return q;},gte:(key:string,value:string)=>{rows=rows.filter(r=>typeof r[key]==='string'&&(r[key] as string)>=value);return q;},lt:(key:string,value:string)=>{rows=rows.filter(r=>typeof r[key]==='string'&&(r[key] as string)<value);return q;},order:()=>q,range:(from:number,to:number)=>Promise.resolve({data:rows.slice(from,to+1),error:table===m.errorTable?{message:'Query failed'}:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:rows.slice(0,500),count:head?rows.length:null,error:table===m.errorTable||head&&m.errorCount?{message:'Query failed'}:null}).then(resolve)};return q;}})}));
vi.mock('@/lib/admin/products',()=>({listAllProducts:async()=>[]}));
import {orderMetrics,revenueWindow,windowMeta} from '@/lib/admin/order-queries';
import {productPerformance} from '@/lib/admin/reports';
import {fetchAll} from '@/lib/admin/paging';
beforeEach(()=>{m.errorTable='';m.errorCount=false;m.tables={orders:[{id:'a',status:'paid',created_at:'2026-06-01T00:00:00Z',paid_at:'2026-08-01T00:00:00Z',total_cents:14500,refunded_cents:0}],admin_order_item_economics:[{id:'line',order_id:'a',qty:1,refunded_qty:0,confirmed_returned_qty:0,unit_cost_cents:9500,line_total_cents:15000,discount_allocated_cents:1500,refunded_cents:0,product_slug:'test',product_name:'Test'}]};});
it('buckets sales by actual paid date and reconciles merchandise gross profit with products',async()=>{
 const chart=await revenueWindow({scale:'month',anchor:'2026-08-01'});const products=await productPerformance(windowMeta('month','2026-08-01'));
 expect(chart.totals).toMatchObject({revenueCents:14500,profitCents:4000});expect(products.totals).toMatchObject({revenueCents:13500,profitCents:4000});
});
it('charts unknown gross profit as null and keeps refunds consumed without evidenced restock',async()=>{
 m.tables.admin_order_item_economics[0].unit_cost_cents=null;expect((await revenueWindow({scale:'month',anchor:'2026-08-01'})).totals.profitCents).toBeNull();
 Object.assign(m.tables.orders[0],{status:'refunded',refunded_cents:14500});Object.assign(m.tables.admin_order_item_economics[0],{unit_cost_cents:9500,refunded_qty:1,refunded_cents:13500});
 expect((await revenueWindow({scale:'month',anchor:'2026-08-01'})).totals.profitCents).toBe(-9500);
});
it('pages orders beyond the PostgREST response cap',async()=>{
 m.tables.orders=Array.from({length:501},(_,i)=>({...m.tables.orders[0],id:String(i)}));m.tables.admin_order_item_economics=m.tables.orders.map(o=>({...m.tables.admin_order_item_economics[0],order_id:o.id,id:`line-${o.id}`}));
 expect((await revenueWindow({scale:'month',anchor:'2026-08-01'})).totals.revenueCents).toBe(7264500);
});
it('throws on report query failure and on paging safety cap instead of partial success',async()=>{
 m.errorTable='orders';await expect(revenueWindow({scale:'month',anchor:'2026-08-01'})).rejects.toThrow('Query failed');
 await expect(fetchAll(async()=>({data:Array(500).fill(1),error:null}),'cap')).rejects.toThrow(/50000/);
});
it('marks product totals incomplete when a paid order has lost its line records',async()=>{
 m.tables.admin_order_item_economics=[];
 expect((await productPerformance(windowMeta('month','2026-08-01'))).totals).toMatchObject({profitCents:null,missingOrders:1});
});

it('dashboard revenue uses payment date, nets later refunds and pages the paid population',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
 try {
  m.tables.orders=Array.from({length:501},(_,i)=>({id:String(i),created_at:'2026-08-01T00:00:00Z',paid_at:'2026-08-09T11:00:00Z',status:'paid',total_cents:11000,refunded_cents:1000}));
  m.tables.orders.push({id:'refund',created_at:'2026-08-01T00:00:00Z',paid_at:'2026-08-09T11:00:00Z',status:'refunded',total_cents:11000,refunded_cents:11000});
  expect(await orderMetrics()).toMatchObject({revenueToday:5010000,revenue7d:5010000,revenue30d:5010000});
 } finally {vi.useRealTimers();}
});
it('dashboard reports query failure instead of zero revenue',async()=>{m.errorTable='orders';await expect(orderMetrics()).rejects.toThrow('Query failed');});

it('keeps current pending and fulfilment populations separate from revenue and exposes count failures',async()=>{
 m.tables.orders=[{id:'pending',status:'pending',paid_at:null},{id:'processing',status:'processing',paid_at:'2020-01-01T00:00:00Z'},{id:'refunded',status:'refunded',paid_at:'2020-01-01T00:00:00Z'}];
 expect(await orderMetrics()).toMatchObject({revenueToday:0,toFulfil:1,pendingPayment:1});
 m.errorCount=true;await expect(orderMetrics()).rejects.toThrow('Query failed');
});
