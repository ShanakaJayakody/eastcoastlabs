import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));
import { drainPaidAnalytics } from '@/lib/paid-analytics';
function payload(){return {client_id:'123456.789012',timestamp_micros:Date.now()*1000,events:[{name:'purchase',params:{transaction_id:'ECL-1001',currency:'AUD',value:27,shipping:5,acquisition_source:'google',acquisition_medium:'cpc',acquisition_campaign:'launch_2026',acquisition_landing_page:'/product/sample',experiment_id:'offer-holdout',experiment_variant:'holdout',items:[{item_id:'sample',item_name:'Sample',item_variant:'5 mg · 3 vials',quantity:3,price:9,discount:1}]}}]}}
let row:{id:string;lease_token:string;payload:ReturnType<typeof payload>};
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('GA4_API_SECRET','test-only-secret');vi.stubEnv('NEXT_PUBLIC_GA4_ID','G-TEST123');vi.stubGlobal('fetch',m.fetch);
 row={id:'row-1',lease_token:'lease-1',payload:payload()};m.fetch.mockResolvedValue({ok:true,status:204});
 const deadIds=new Set<string>();
 m.rpc.mockImplementation(async(name:string,args?:{p_id:string;p_permanent:boolean})=>{
  if(name==='finish_paid_analytics'&&args?.p_permanent)deadIds.add(args.p_id);
  return {data:name==='claim_paid_analytics'?[row]:name==='paid_analytics_dead_count'?deadIds.size:true,error:null};
 });
});
it('does not claim or deliver when optional analytics configuration is absent',async()=>{
 vi.stubEnv('GA4_API_SECRET','');expect(await drainPaidAnalytics(1)).toMatchObject({disabled:true,accepted:0});expect(m.rpc).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();
});
it('sends the frozen payment time and stable transaction ID on uncertain retries',async()=>{
 m.fetch.mockRejectedValueOnce(new Error('Transport error containing secret URL'));await drainPaidAnalytics(1);await drainPaidAnalytics(1);
 const first=JSON.parse(m.fetch.mock.calls[0][1].body);const second=JSON.parse(m.fetch.mock.calls[1][1].body);
 expect(second).toEqual(first);expect(first.timestamp_micros).toBe(row.payload.timestamp_micros);expect(first.events[0].params.transaction_id).toBe('ECL-1001');
 expect(m.rpc.mock.calls.filter(c=>c[0]==='finish_paid_analytics')[0][1]).toMatchObject({p_accepted:false,p_permanent:false,p_error:'Analytics transport failed'});
});
it('only sends allowlisted analytics fields even if queue JSON contains personal data',async()=>{
 Object.assign(row.payload,{email:'private@example.test',user_id:'secret',page_location:'https://example.test/pay/token'});
 Object.assign(row.payload.events[0].params,{customer_name:'Private Buyer',address:'Private Street'});
 expect(await drainPaidAnalytics(1)).toMatchObject({accepted:1});
 const body=m.fetch.mock.calls[0][1].body;expect(body).not.toMatch(/private|secret|email|address|token|user_id|page_location/i);
 expect(m.fetch.mock.calls[0][0]).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=test-only-secret');
 expect(m.fetch.mock.calls[0][1]).toMatchObject({method:'POST',redirect:'error'});
});
it('forwards only validated acquisition, experiment and canonical item dimensions from the frozen snapshot',async()=>{
 await drainPaidAnalytics(1);const body=JSON.parse(m.fetch.mock.calls[0][1].body);
 expect(body.events[0].params).toEqual({transaction_id:'ECL-1001',currency:'AUD',value:27,shipping:5,acquisition_source:'google',acquisition_medium:'cpc',acquisition_campaign:'launch_2026',acquisition_landing_page:'/product/sample',experiment_id:'offer-holdout',experiment_variant:'holdout',items:[{item_id:'sample',item_name:'Sample',item_variant:'5 mg · 3 vials',quantity:3,price:9,discount:1}]});
 Object.assign(row.payload.events[0].params,{acquisition_campaign:'private@example.test'});m.fetch.mockClear();expect(await drainPaidAnalytics(1)).toMatchObject({dead:1});expect(m.fetch).not.toHaveBeenCalled();
});
it('retires invalid amounts and expired timestamps without provider requests',async()=>{
 row.payload.events[0].params.value=28;expect(await drainPaidAnalytics(1)).toMatchObject({dead:1});expect(m.fetch).not.toHaveBeenCalled();
 row.payload=payload();row.payload.timestamp_micros=(Date.now()-73*3600_000)*1000;expect(await drainPaidAnalytics(1)).toMatchObject({dead:1});expect(m.fetch).not.toHaveBeenCalled();
});
it('retries rate limits but retires permanent HTTP client errors without logging secrets',async()=>{
 m.fetch.mockResolvedValueOnce({ok:false,status:429});expect(await drainPaidAnalytics(1)).toMatchObject({failed:1});
 m.fetch.mockResolvedValueOnce({ok:false,status:400});expect(await drainPaidAnalytics(1)).toMatchObject({dead:1});
 expect(m.rpc.mock.calls.filter(c=>c[0]==='finish_paid_analytics').map(c=>c[1].p_error)).toEqual(['Analytics HTTP 429','Analytics HTTP 400']);
});
it('surfaces bookkeeping failure after provider acceptance rather than reporting success',async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name==='claim_paid_analytics'?[row]:false,error:null}));
 await expect(drainPaidAnalytics(1)).rejects.toThrow(/persist|lease/i);expect(m.fetch).toHaveBeenCalledOnce();
});

it('reports outstanding dead rows even when no analytics intent remains claimable',async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name==='claim_paid_analytics'?[]:name==='paid_analytics_dead_count'?4:true,error:null}));
 expect(await drainPaidAnalytics(1)).toMatchObject({accepted:0,failed:0,dead:4});expect(m.fetch).not.toHaveBeenCalled();
});

it('sends an immutable incremental refund with goods separate from shipping, strips PII and keeps its event time',async()=>{
 row.payload={client_id:'123456.789012',timestamp_micros:Date.now()*1000,events:[{name:'refund',params:{transaction_id:'ECL-1001',currency:'AUD',value:18,shipping:5}}]} as ReturnType<typeof payload>;
 Object.assign(row.payload.events[0].params,{email:'private@example.test'});
 await drainPaidAnalytics(1);
 expect(m.fetch).toHaveBeenCalledTimes(1);
 const first=JSON.parse(m.fetch.mock.calls[0][1].body);
 expect(first.events).toEqual([{name:'refund',params:{transaction_id:'ECL-1001',currency:'AUD',value:18,shipping:5}}]);
 expect(first.timestamp_micros).toBe(row.payload.timestamp_micros);
});

it('retires an ambiguous refund transport instead of automatically repeating a financial delta',async()=>{
 row.payload.events[0].name='refund';m.fetch.mockRejectedValueOnce(new Error('Uncertain transport'));
 expect(await drainPaidAnalytics(1)).toMatchObject({dead:1,failed:0});
 expect(m.rpc.mock.calls.find(c=>c[0]==='finish_paid_analytics')?.[1]).toMatchObject({p_accepted:false,p_permanent:true,p_error:'Refund transport outcome unknown; reconcile analytics before any correction'});
});
