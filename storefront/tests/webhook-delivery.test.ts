import {beforeEach,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
const m=vi.hoisted(()=>({from:vi.fn(),upsert:vi.fn(),rpc:vi.fn(),lookup:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:m.from,rpc:m.rpc})}));
vi.mock('@/lib/admin/audit',()=>({logAudit:vi.fn(async()=>{})}));
import {POST} from '@/app/api/webhooks/resend/route';
import {verifySvixSignature} from '@/lib/email/webhook-verify';
const key=Buffer.from('test-only-webhook-secret-32-bytes!!');
function request(type='email.delivered'){
 const body=JSON.stringify({type,data:{email_id:'provider-1',to:['buyer@example.test'],click:{link:'https://www.eastcoastlabs.com.au/pay/private?token=secret'}}});
 const timestamp=String(Math.floor(Date.now()/1000));const id='event-1';
 const signature=createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest('base64');
 return new Request('https://example.test/webhook',{method:'POST',body,headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':`v1,${signature}`}});
}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('RESEND_WEBHOOK_SECRET',`whsec_${key.toString('base64')}`);
 m.upsert.mockResolvedValue({error:null});m.rpc.mockResolvedValue({error:null});m.lookup.mockResolvedValue({data:null,error:null});
 const q={eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:m.lookup};
 m.from.mockImplementation(()=>({select:()=>q,upsert:m.upsert}));
});
it('fails closed without a signing secret even in development',()=>{
 expect(verifySvixSignature('',{id:null,timestamp:null,signature:null},undefined).ok).toBe(false);
});
it('does not attribute an unmatched provider ID to the last email sent to that address',async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(m.lookup).toHaveBeenCalledTimes(1);
 expect(m.upsert.mock.calls[0][0].outbox_id).toBeNull();
 expect(JSON.stringify(m.upsert.mock.calls[0][0].detail)).not.toContain('token=');
});
it('returns a retryable failure when a verified event cannot be persisted',async()=>{
 m.upsert.mockResolvedValue({error:{message:'offline'}});
 expect((await POST(request())).status).toBe(503);
});
