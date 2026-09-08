import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({send:vi.fn(),rpc:vi.fn(),allowed:true,template:'cart_recovery_confirmation'}));
vi.mock('resend',()=>({Resend:class{emails={send:m.send};}}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));
vi.mock('@/lib/settings',()=>({getSettings:async()=>({supportEmail:'support@test.local',freeShippingThreshold:150})}));
import {drainOutbox} from '@/lib/email/sender';
import {recoveryLink} from '@/lib/recovery-token';
const requestId='00000000-0000-0000-0000-000000000001';
beforeEach(()=>{
 vi.clearAllMocks();m.allowed=true;m.template='cart_recovery_confirmation';
 vi.stubEnv('RESEND_API_KEY','synthetic-provider');vi.stubEnv('ORDER_ACCESS_SECRET','synthetic-recovery-signing-key-over-32-characters');vi.stubEnv('UNSUBSCRIBE_SECRET','synthetic-unsubscribe');
 m.send.mockResolvedValue({data:{id:'fake-delivery'},error:null});
 m.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>({error:null,data:name==='claim_email_outbox'?[{id:'synthetic-outbox',lease_token:'synthetic-lease',template:m.template,to_email:'synthetic@test.local',payload:{recovery_request_id:requestId,recovery_episode_id:'00000000-0000-0000-0000-000000000002'}}]:name==='prepare_email_delivery_v2'?{subject:args.p_subject,html:args.p_html,from:args.p_from,tag:args.p_id}:name==='authorize_email_delivery'?m.allowed:null}));
});
it('delivers the real confirmation and reminder templates through a fake provider with the same private restore link',async()=>{
 for(const template of ['cart_recovery_confirmation','abandoned_cart','abandoned_cart_2','abandoned_cart_3']){
  m.template=template;expect(await drainOutbox(1)).toMatchObject({sent:1});
  const message=m.send.mock.calls.at(-1)![0];expect(message.html).toContain(recoveryLink(requestId));expect(message.to).toBe('synthetic@test.local');
 }
});
it('never calls the fake provider when delivery eligibility is revoked after rendering',async()=>{
 m.allowed=false;expect(await drainOutbox(1)).toMatchObject({sent:0,cancelled:1});expect(m.send).not.toHaveBeenCalled();
});
