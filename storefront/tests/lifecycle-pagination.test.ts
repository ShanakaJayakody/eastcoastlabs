import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),queue:vi.fn(),queries:[] as {table:string;columns:string;orders:string[];ids:unknown[][];start:number;end:number}[]}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{
 const state={table,columns:'',orders:[] as string[],ids:[] as unknown[][],start:0,end:499};
 const filters:{key:string;values:unknown[]}[]=[];
 const q={select:(v:string)=>{state.columns=v;return q;},in:(key:string,values:unknown[])=>{state.ids.push(values);filters.push({key,values});return q;},not:()=>q,is:()=>q,gte:()=>q,lte:()=>q,neq:()=>q,contains:()=>q,eq:()=>q,
 order:(key:string)=>{state.orders.push(key);return q;},limit:(n:number)=>{state.end=n-1;return q;},range:(start:number,end:number)=>{state.start=start;state.end=end;return q;},
 then:(resolve:(value:unknown)=>unknown)=>{m.queries.push({...state});const result=m.read(table,state.columns,state.start);let rows=result.data??[];
 for(const filter of filters)if(rows.some((r:Record<string,unknown>)=>filter.key in r))rows=rows.filter((r:Record<string,unknown>)=>filter.values.includes(r[filter.key]));
 return Promise.resolve({...result,data:result.data===null?null:rows.slice(state.start,state.end+1)}).then(resolve);}};return q;
}})}));
vi.mock('@/lib/admin/email',()=>({queueEmail:m.queue}));
vi.mock('@/lib/admin/overrides',()=>({pausedEmailsFor:async()=>new Set()}));
vi.mock('@/lib/email/unsubscribe',()=>({unsubscribeUrl:()=>'/unsubscribe/test-only'}));
vi.mock('@/lib/order-access',()=>({createOrderAccessToken:()=> 'test-only'}));
import {sweepWelcomeSeries,sweepPostPurchase,sweepReviewThankYou,sweepReplenishment,sweepWinback,sweepSecondPurchaseNudge} from '@/lib/admin/lifecycle';
const iso=(days:number)=>new Date(Date.now()-days*86400000).toISOString();
const last='buyer500@example.test';
beforeEach(()=>{vi.clearAllMocks();m.queries.length=0;m.queue.mockImplementation(async(s:{to:string})=>s.to===last?'new-outbox-id':null)});
it.each([
 ['welcome',sweepWelcomeSeries,'subscribers',5],['post-purchase',sweepPostPurchase,'orders',6],['review thanks',sweepReviewThankYou,'reviews',2],
 ['replenishment',sweepReplenishment,'orders',22],['winback',sweepWinback,'customers',65],['second purchase',sweepSecondPurchaseNudge,'customers',32],
] as const)('processes the later %s cohort after the first 500 deduplicated candidates',async(name,sweep,table,age)=>{
 const candidates=Array.from({length:501},(_,n)=>({id:String(n).padStart(6,'0'),email:`buyer${n}@example.test`,customer_email:`buyer${n}@example.test`,source:'footer',created_at:iso(age),shipped_at:iso(age),last_order_at:iso(age),orders_count:1,order_number:`ECL-${n}`,rating:5,orders:{customer_email:`buyer${n}@example.test`},order_items:[{product_slug:'sample',product_name:'Sample',qty:1,variant_label:'1 vial',product_variants:{pack_size:1}}]}));
 m.read.mockImplementation((t:string,columns:string)=>({data:t===table&&((t==='subscribers'&&columns.includes('source'))||(t==='orders'&&columns.includes('order_items'))||(t==='reviews'&&columns.includes('rating'))||t==='customers')?candidates:[],error:null}));
 expect(await sweep()).toEqual({queued:1});expect(m.queue).toHaveBeenCalledTimes(501);
 expect(m.queue).toHaveBeenCalledWith(expect.objectContaining({to:last}));
 const paged=m.queries.filter(q=>q.table===table&&q.start===500);expect(paged.length).toBeGreaterThan(0);
 expect(paged.every(q=>q.orders.includes(table==='customers'?'email':'id'))).toBe(true);
 expect(m.queries.flatMap(q=>q.ids).every(ids=>ids.length<=200)).toBe(true);
 if(name==='welcome')expect(m.queue.mock.calls.at(-1)?.[0].relatedId).toBe(`${last}:welcome:3`);
});
it('fails closed on a later candidate page instead of sending a partial cohort',async()=>{
 const candidates=Array.from({length:500},(_,n)=>({email:`buyer${n}@example.test`,orders_count:1,last_order_at:iso(65)}));
 m.read.mockImplementation((_table:string,_columns:string,start:number)=>start===500?{data:null,error:{message:'second page failed'}}:{data:candidates,error:null});
 await expect(sweepWinback()).rejects.toThrow('second page failed');expect(m.queue).not.toHaveBeenCalled();
});

it('paginates a large related lookup inside its email chunk before deciding eligibility',async()=>{
 const candidates=Array.from({length:501},(_,n)=>({id:String(n),email:`buyer${n}@example.test`,source:'footer',created_at:iso(5)}));
 const history=[...Array.from({length:500},(_,n)=>({id:String(n),customer_email:'buyer400@example.test'})),{id:'last',customer_email:last}];
 m.read.mockImplementation((table:string,columns:string)=>({data:table==='subscribers'&&columns.includes('source')?candidates:table==='orders'?history:[],error:null}));
 expect(await sweepWelcomeSeries()).toEqual({queued:0});
 expect(m.queue).not.toHaveBeenCalledWith(expect.objectContaining({to:last}));
 expect(m.queries.some(q=>q.table==='orders'&&q.start===500)).toBe(true);
});
