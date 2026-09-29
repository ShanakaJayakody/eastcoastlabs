import {aggregatePaidRevenue} from '@/lib/admin/overview/revenue';
import type {OverviewRange} from '@/lib/admin/overview/types';
export const now=new Date('2026-09-29T02:00:00Z');
export const facts=Array.from({length:58},(_,i)=>({id:'synthetic-'+i,paid_at:new Date(Date.UTC(2026,7,31+i,23)).toISOString(),total_cents:15000+((i*7919)%95000)}));
export async function loadOverviewRevenue(range:OverviewRange){return aggregatePaidRevenue(facts,range,now);}
export async function signOut(){}
export async function searchAdmin(){return [];}
export async function bulkConfirmPayment(){throw Error('Synthetic read-only fixture');}
export async function bulkReinstate(){throw Error('Synthetic read-only fixture');}
export async function loadOrderPreview(id:string){return {id,order_number:'#QA-1042',status:'paid',customer_name:'Synthetic customer',paid_at:'2026-09-28T00:00:00Z',total_cents:24500,items:[{id:'item',product_name:'Research compound',variant_label:'3-pack · 10 mg/mL',size_label:'Changed catalogue label',qty:2,line_total_cents:24500}]};}
