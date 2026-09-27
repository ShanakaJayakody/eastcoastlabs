import { beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),queue:vi.fn(),unsubscribe:vi.fn(),contains:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{
 const filters:Record<string,unknown>={};let columns='';
 const q={select:(v:string)=>{columns=v;return q;},in:()=>q,not:()=>q,is:()=>q,gte:()=>q,lte:()=>q,neq:()=>q,contains:(...args:unknown[])=>{m.contains(table,...args);return q;},order:()=>q,limit:()=>q,range:()=>q,
 eq:(k:string,v:unknown)=>{filters[k]=v;return q;},then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(m.read(table,columns,filters)).then(resolve)};return q;
}})}));
vi.mock('@/lib/admin/email',()=>({queueEmail:m.queue}));
vi.mock('@/lib/email/unsubscribe',()=>({unsubscribeUrl:m.unsubscribe}));
import {sweepWelcomeSeries,sweepPostPurchase,sweepReviewThankYou,sweepReplenishment,sweepWinback,sweepSecondPurchaseNudge} from '@/lib/admin/lifecycle';
const subscribers=['new@example.test','duplicate@example.test'].map(email=>({email,source:'footer',created_at:new Date(Date.now()-5*86400000).toISOString()}));
beforeEach(()=>{vi.stubEnv("REORDER_REMINDER_DAYS","21");
 vi.clearAllMocks();m.unsubscribe.mockReturnValue('https://example.test/unsubscribe');
 m.read.mockImplementation((table:string,columns:string)=>({data:table==='subscribers'&&columns.includes('source')?subscribers:[],error:null}));
 m.queue.mockResolvedValue(null);
});
it.each([sweepWelcomeSeries,sweepPostPurchase,sweepReviewThankYou,sweepReplenishment,sweepWinback,sweepSecondPurchaseNudge].map(sweep=>[sweep.name,sweep] as const))('surfaces recipient lookup errors from %s',async (_name,sweep)=>{
 m.read.mockReturnValue({data:null,error:{message:'database unavailable'}});
 await expect(sweep()).rejects.toThrow(/database unavailable/);
});
it.each(['orders','subscribers','sequence_overrides'])('fails closed when the %s eligibility lookup fails',async table=>{
 m.read.mockImplementation((name:string,columns:string)=>name==='subscribers'&&columns.includes('source')?{data:subscribers,error:null}:
 name===table?{data:null,error:{message:'eligibility unavailable'}}:{data:[],error:null});
 await expect(sweepWelcomeSeries()).rejects.toThrow(/eligibility unavailable/);
});
it('counts only inserted outbox rows, not deduplicated queue attempts',async()=>{
 m.queue.mockResolvedValueOnce('new-outbox-row').mockResolvedValueOnce(null);
 expect(await sweepWelcomeSeries()).toEqual({queued:1});
});
it('reports missing unsubscribe signing configuration as a failed job',async()=>{
 m.unsubscribe.mockReturnValue(null);
 await expect(sweepWelcomeSeries()).rejects.toThrow(/unsubscribe/i);
});
it('sends valid JSON to the accessory category lookup',async()=>{
 const shipped_at=new Date(Date.now()-6*86400000).toISOString();
 m.read.mockImplementation((table:string)=>({data:table==='orders'?[{id:'order',order_number:'ECL-1',customer_email:'buyer@example.test',created_at:shipped_at,shipped_at,order_items:[{product_slug:'sample',product_name:'Sample'}]}]:[],error:null}));

 await sweepPostPurchase();

 expect(m.contains).toHaveBeenCalledWith('products','categories',JSON.stringify(['accessory']));
});
it('does not inspect recipients or infer pack depletion when reorder timing is disabled',async()=>{vi.stubEnv('REORDER_REMINDER_DAYS','');expect(await sweepReplenishment()).toEqual({queued:0});expect(m.read).not.toHaveBeenCalled();vi.unstubAllEnvs();});
