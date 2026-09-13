import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({send:vi.fn(),rpc:vi.fn(),render:vi.fn()}));
vi.mock("@/lib/admin/retention-delivery",()=>({retentionDeliveryReason:async()=>null}));
vi.mock("resend",()=>({Resend:class{emails={send:m.send};}}));
vi.mock("@/lib/admin/db",()=>({adminDb:()=>({rpc:m.rpc})}));
vi.mock("@/lib/email/templates",()=>({renderTemplate:m.render}));
import { drainOutbox } from "@/lib/email/sender";
const row={id:"id-1",lease_token:"lease-1",template:"payment_instructions",to_email:"buyer@example.test",payload:{}};
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("RESEND_API_KEY","test-only");
 m.render.mockResolvedValue({subject:"Test",html:"Test",from:"Test <test@example.test>",tag:"id-1"});m.send.mockResolvedValue({data:{id:"provider-1"},error:null});
 m.rpc.mockImplementation(async(name:string)=>({data:name==="prepare_email_delivery_v2"?{subject:"Test",html:"Test",from:"Test <test@example.test>",tag:"id-1"}:name==="claim_email_outbox"?[row]:name==="authorize_email_delivery"?true:null,error:null}));
});
it("uses the same provider idempotency key on retried delivery",async()=>{
 await drainOutbox(1);await drainOutbox(1);
 expect(m.send).toHaveBeenCalledTimes(2);
 for(const call of m.send.mock.calls)expect(call[1]).toEqual({idempotencyKey:"ecl-outbox/id-1"});
});
it("does not deliver a cancelled or newly suppressed claimed row",async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name==="prepare_email_delivery_v2"?{subject:"Test",html:"Test",from:"Test <test@example.test>",tag:"id-1"}:name==="claim_email_outbox"?[row]:false,error:null}));
 expect(await drainOutbox(1)).toMatchObject({sent:0,cancelled:1});expect(m.send).not.toHaveBeenCalled();
});
it("surfaces persistence failure after provider acceptance for reconciliation",async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name==="prepare_email_delivery_v2"?{subject:"Test",html:"Test",from:"Test <test@example.test>",tag:"id-1"}:name==="claim_email_outbox"?[row]:true,error:name==="finish_email_outbox"?{message:"database offline"}:null}));
 await expect(drainOutbox(1)).rejects.toThrow(/persist|reconcil/i);
 expect(m.send).toHaveBeenCalledTimes(1);
});
it('sends the frozen sender with frozen body even when deployment defaults change',async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name.startsWith('prepare_email_delivery_v2')?{subject:'Frozen',html:'Frozen body',from:'Original <original@example.test>',tag:'id-1'}:name==='claim_email_outbox'?[row]:true,error:null}));
 await drainOutbox(1);expect(m.send.mock.calls[0][0]).toMatchObject({from:'Original <original@example.test>',subject:'Frozen',html:'Frozen body'});
 expect(m.rpc.mock.calls.find(call=>call[0].startsWith('prepare_email_delivery_v2'))?.[0]).toBe('prepare_email_delivery_v2');
});

it('binds provider retrieval to the same frozen outbox tag on every send',async()=>{
 m.rpc.mockImplementation(async(name:string)=>({data:name==='prepare_email_delivery_v2'?{subject:'Frozen',html:'Body',from:'Sender',tag:'id-1'}:name==='claim_email_outbox'?[row]:true,error:null}));
 await drainOutbox(1);await drainOutbox(1);for(const call of m.send.mock.calls)expect(call[0].tags).toEqual([{name:'ecl_outbox_id',value:'id-1'}]);
});
it('records a persisted retention holdout as cancelled after current eligibility without calling the provider',async()=>{
 const held={...row,template:'winback_60',payload:{retention_experiment:{id:'retention-v1',arm:'holdout',percent:10,bucket:1}}};
 vi.stubEnv('UNSUBSCRIBE_SECRET','test-only-strong-unsubscribe-secret');
 m.rpc.mockImplementation(async(name:string)=>({data:name==='prepare_email_delivery_v2'?{subject:'Frozen',html:'Body',from:'Sender',tag:'id-1'}:name==='claim_email_outbox'?[held]:name==='email_delivery_ineligible'?null:true,error:null}));
 expect(await drainOutbox(1)).toEqual({sent:0,failed:0,cancelled:1});expect(m.send).not.toHaveBeenCalled();
 expect(m.rpc).toHaveBeenCalledWith('finish_email_outbox',expect.objectContaining({p_status:'cancelled',p_error:'Retention holdout: retention-v1'}));
 expect(m.rpc).not.toHaveBeenCalledWith('authorize_email_delivery',expect.anything());
});
it('cancels an old queued reorder when explicit reminder timing is absent',async()=>{
 vi.stubEnv('REORDER_REMINDER_DAYS','');vi.stubEnv('UNSUBSCRIBE_SECRET','test-only-strong-unsubscribe-secret');
 m.rpc.mockImplementation(async(name:string)=>({data:name==='prepare_email_delivery_v2'?{subject:'Frozen',html:'Body',from:'Sender',tag:'id-1'}:name==='claim_email_outbox'?[{...row,template:'replenishment'}]:true,error:null}));
 expect(await drainOutbox(1)).toMatchObject({cancelled:1,sent:0});expect(m.send).not.toHaveBeenCalled();
});
