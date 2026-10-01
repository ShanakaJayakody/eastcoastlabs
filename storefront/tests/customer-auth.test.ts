import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),send:vi.fn(),verify:vi.fn(),values:new Map<string,string>(),set:vi.fn(),delete:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(k:string)=>m.values.has(k)?{value:m.values.get(k)}:undefined,set:m.set,delete:m.delete}),headers:async()=>new Headers()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({rpc:m.rpc,from:()=>({delete:()=>({eq:async()=>({error:null})})})})}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{signInWithOtp:m.send,verifyOtp:m.verify}})}));
import {requestCustomerCode,verifyCustomerCode,customerSignOut} from '@/lib/customer-auth/actions';
beforeEach(()=>{vi.clearAllMocks();m.values.clear();vi.stubEnv('CUSTOMER_ACCOUNTS_ENABLED','1');vi.stubEnv('ORDER_ACCESS_SECRET','k'.repeat(32));vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','test');m.send.mockResolvedValue({error:null});m.rpc.mockImplementation(async(name:string)=>({data:name==='customer_begin_login'?'10000000-0000-0000-0000-000000000001':name==='customer_reserve_verification'?{email:'buyer@example.test',lease:'20000000-0000-0000-0000-000000000001'}:null,error:null}));});
it('sends a code only after a persistent throttle succeeds',async()=>{
 m.rpc.mockResolvedValueOnce({error:{message:'rate limit'},data:null});
 expect((await requestCustomerCode('buyer@example.test')).ok).toBe(false);expect(m.send).not.toHaveBeenCalled();
 expect((await requestCustomerCode(' BUYER@example.test ')).ok).toBe(true);
 expect(m.send).toHaveBeenCalledWith(expect.objectContaining({email:'buyer@example.test'}));
 expect(m.set).toHaveBeenCalledWith('ecl_customer_challenge',expect.any(String),expect.objectContaining({httpOnly:true,sameSite:'lax',maxAge:600}));
});
it('creates an isolated customer cookie only after verifying the challenge mailbox',async()=>{
 m.values.set('ecl_customer_challenge','10000000-0000-0000-0000-000000000001');
 m.verify.mockResolvedValue({data:{user:{id:'30000000-0000-0000-0000-000000000001',email:'stranger@example.test',email_confirmed_at:'2026-09-30'}},error:null});
 expect((await verifyCustomerCode('123456')).ok).toBe(false);expect(m.set).not.toHaveBeenCalled();
 m.verify.mockResolvedValue({data:{user:{id:'30000000-0000-0000-0000-000000000001',email:'buyer@example.test',email_confirmed_at:'2026-09-30'}},error:null});
 expect((await verifyCustomerCode('123456')).ok).toBe(true);
 expect(m.set).toHaveBeenCalledWith('ecl_customer_session',expect.stringMatching(/^[\w-]{43}$/),expect.objectContaining({httpOnly:true,maxAge:604800}));
});
it('cannot create a session for an expired challenge or unverified user',async()=>{
 expect((await verifyCustomerCode('123456')).ok).toBe(false);
 m.values.set('ecl_customer_challenge','10000000-0000-0000-0000-000000000001');m.verify.mockResolvedValue({data:{user:{id:'x',email:'buyer@example.test',email_confirmed_at:null}},error:null});
 expect((await verifyCustomerCode('123456')).ok).toBe(false);expect(m.set).not.toHaveBeenCalled();
});
it('signs out only the customer session, preserving admin cookies',async()=>{
 m.values.set('ecl_customer_session','a'.repeat(43));await customerSignOut();
 expect(m.delete.mock.calls.map(c=>c[0])).toEqual(['ecl_customer_session','ecl_customer_challenge']);
});
it('does not turn a successful sign-in into an error if reservation cleanup is unavailable',async()=>{
 m.values.set('ecl_customer_challenge','10000000-0000-0000-0000-000000000001');
 m.verify.mockResolvedValue({data:{user:{id:'30000000-0000-0000-0000-000000000001',email:'buyer@example.test',email_confirmed_at:'2026-09-30'}},error:null});
 const original=m.rpc.getMockImplementation()!;
 m.rpc.mockImplementation((name:string,...args:unknown[])=>name==='customer_finish_verification'?Promise.reject(new Error('network')):original(name,...args));
 expect((await verifyCustomerCode('123456')).ok).toBe(true);
});
