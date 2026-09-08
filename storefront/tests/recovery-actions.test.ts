import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),resolve:vi.fn(),set:vi.fn(),get:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('next/server',()=>({after:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({set:m.set,get:m.get})}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));vi.mock('@/lib/checkout',()=>({resolveCart:m.resolve}));
import {requestCartRecovery,confirmCartRecovery} from '@/app/cart-recovery/actions';
import {verifiedRecoveryEpisode} from '@/lib/recovery-consent';
const id='00000000-0000-0000-0000-000000000001';
const line={key:'sample:1',slug:'sample',variantLabel:'1 vial',variantId:id,quantity:1};
const resolved={lines:[{...line,name:'Sample',unitPriceCents:1000,lineTotalCents:1000,isGift:false}],subtotalCents:1000,warnings:[]};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('ORDER_ACCESS_SECRET','synthetic-key-that-is-at-least-32-characters');m.resolve.mockResolvedValue(resolved);m.rpc.mockResolvedValue({data:id,error:null});});
it('requires explicit purpose agreement before resolving or capturing contact',async()=>{
 expect((await requestCartRecovery('person@test.local',[line],false)).ok).toBe(false);expect(m.rpc).not.toHaveBeenCalled();expect(m.resolve).not.toHaveBeenCalled();
 await requestCartRecovery('Person@Test.local',[line],true);
 expect(m.rpc).toHaveBeenCalledWith('recovery_request',expect.objectContaining({p_email:'person@test.local',p_hash:expect.stringMatching(/^[a-f0-9]{64}$/),p_cart:resolved.lines}));
 expect(JSON.stringify(m.rpc.mock.calls)).not.toContain('token=');
});
it('rejects malformed structured IDs and invalid contacts before persistence',async()=>{
 for(const [email,lines] of [['bad',[line]],['person@test.local',[{...line,variantId:''}]]] as const)expect((await requestCartRecovery(email,[...lines],true)).ok).toBe(false);
 expect(m.rpc).not.toHaveBeenCalled();
});
it('restores repriced lines only after valid proof and keeps its bearer in an HttpOnly cookie',async()=>{
 m.rpc.mockResolvedValue({data:{episode_id:id,cart:resolved.lines,restore_expires_at:'2026-10-01T00:00:00Z'},error:null});
 const result=await confirmCartRecovery('a'.repeat(43));expect(result).toMatchObject({ok:true,lines:[expect.objectContaining({variantId:id,unitPrice:10})]});
 expect(m.set).toHaveBeenCalledWith('ecl_cart_recovery','a'.repeat(43),expect.objectContaining({httpOnly:true,sameSite:'lax',path:'/checkout'}));
 expect(JSON.stringify(result)).not.toContain('a'.repeat(43));
});
it('fails invalid links without touching cart or cookie and attribution requires a private cookie',async()=>{
 expect((await confirmCartRecovery('bad')).ok).toBe(false);expect(m.set).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();
 m.get.mockReturnValue(undefined);expect(await verifiedRecoveryEpisode('person@test.local',[line])).toBeUndefined();
 expect(m.rpc).not.toHaveBeenCalled();
});
