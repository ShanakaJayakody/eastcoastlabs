import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),single:vi.fn(),get:vi.fn(),auth:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc,from:()=>({select:()=>({eq:()=>({single:m.single})})})})}));
vi.mock('resend',()=>({Resend:class{emails={get:m.get};}}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:m.auth}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {emailOperation} from '@/lib/admin/email-operations';
import {operateEmail} from '@/app/admin/(dashboard)/automation/actions';
const row={id:'00000000-0000-0000-0000-000000000001',to_email:'buyer@example.test',rendered_tag:'00000000-0000-0000-0000-000000000001',rendered_from:'Sender <sender@example.test>',rendered_subject:'Frozen',rendered_html:'<p>Original private link</p>',provider_attempted_at:'2026-09-08T00:00:00+00:00',provider_message_id:null,status:'dead',lease_token:null,lease_expires_at:null};
const provider={tags:[{name:'ecl_outbox_id',value:row.id}],id:'provider-1',to:[row.to_email],from:row.rendered_from,subject:row.rendered_subject,html:row.rendered_html,text:null,cc:[],bcc:[],last_event:'delivered',created_at:'2026-09-08T00:00:01Z'};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('RESEND_API_KEY','synthetic');m.single.mockResolvedValue({data:{...row},error:null});m.rpc.mockResolvedValue({data:'sent',error:null});m.get.mockResolvedValue({data:{...provider},error:null});m.auth.mockResolvedValue({email:'operator@example.test'});});
it('repairs a missing provider ID only after exact read-only frozen-message retrieval proof',async()=>{
 expect(await emailOperation(row.id,'reconcile','Checked provider','operator@example.test','provider-1')).toBe('sent');
 expect(m.get).toHaveBeenCalledWith('provider-1');expect(m.rpc).toHaveBeenCalledWith('admin_reconcile_email',expect.objectContaining({p_provider_id:'provider-1',p_snapshot:{to:row.to_email,from:row.rendered_from,subject:row.rendered_subject,html:row.rendered_html,tag:row.rendered_tag,provider_attempted_at:row.provider_attempted_at,status:'dead',lease_token:null}}));
});
it.each([{tags:undefined},{tags:[]},{tags:[{name:'ecl_outbox_id',value:'another-identical-intent'}]},{html:'Changed'},{from:'other@example.test'},{to:['other@example.test']},{subject:'Changed'},{html:null},{last_event:'scheduled'},{id:'wrong'},{cc:['private@example.test']}])('leaves uncertain or mismatched provider content unresolved (%j)',async patch=>{
 m.get.mockResolvedValue({data:{...provider,...patch},error:null});await expect(emailOperation(row.id,'reconcile','Checked','operator@example.test','provider-1')).rejects.toThrow(/match|proof|reconcil/i);expect(m.rpc).not.toHaveBeenCalled();
});
it('does not guess an absent historical sender or expose provider retrieval errors',async()=>{
 m.single.mockResolvedValue({data:{...row,rendered_from:null},error:null});await expect(emailOperation(row.id,'reconcile','Checked','operator@example.test','provider-1')).rejects.toThrow(/frozen/i);expect(m.get).not.toHaveBeenCalled();
 m.single.mockResolvedValue({data:row,error:null});m.get.mockRejectedValue(new Error('Secret provider response'));await expect(emailOperation(row.id,'reconcile','Checked','operator@example.test','provider-1')).rejects.toThrow('Provider retrieval unavailable; message remains unresolved');
});
it('actions require admin identity and never accept an actor from client input',async()=>{
 m.auth.mockRejectedValueOnce(new Error('Not authorized'));await expect(operateEmail(row.id,'cancel','Reason')).rejects.toThrow('Not authorized');expect(m.rpc).not.toHaveBeenCalled();
 expect(await operateEmail(row.id,'cancel','Reason')).toMatchObject({ok:true});expect(m.rpc).toHaveBeenCalledWith('admin_email_operation',expect.objectContaining({p_actor:'operator@example.test',p_action:'cancel'}));
});
