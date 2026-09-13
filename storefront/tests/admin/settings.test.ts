import {it,expect,vi} from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:1,error:null}))}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'operator@test.local'})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:()=>{throw Error('Unexpected persistence');},rpc})}));
import {saveSettings} from '@/app/admin/(dashboard)/settings/actions';
const input={announcementItems:['Hello'],freeShippingThreshold:0,giftThreshold:0,supportEmail:'valid@test.local',payidEnabled:true,payidIdentifier:'valid@test.local',payidName:'Test',bankTransferEnabled:false,bankBsb:'',bankAccountNumber:'',bankAccountName:'',paymentWindowHours:24,paymentExpiryHours:48,standardShippingCents:0,expressShippingEnabled:false,expressShippingCents:0,expressFreeThreshold:0};
it.each([NaN,Infinity,-1,0.5])('rejects invalid shipping cents %s before persistence',async value=>{
 expect(await saveSettings({...input,standardShippingCents:value})).toMatchObject({ok:false,error:expect.stringMatching(/shipping/i)});
});
it.each([NaN,Infinity,-1,0,721])('rejects invalid hold hours %s before persistence',async value=>{
 expect(await saveSettings({...input,paymentWindowHours:value})).toMatchObject({ok:false,error:expect.stringMatching(/hold|window/i)});
});
it('rejects malformed public ABN and unbounded identity copy',async()=>{
 expect(await saveSettings({...input,abn:'not-an-abn'})).toMatchObject({ok:false,error:expect.stringMatching(/ABN/)});
 expect(await saveSettings({...input,legalName:'x'.repeat(161)})).toMatchObject({ok:false,error:expect.stringMatching(/legal name/i)});
});
it.each(['00000000000','51824753557'])('rejects an 11-digit ABN with an invalid checksum: %s',async abn=>{
 rpc.mockClear();
 expect(await saveSettings({...input,abn})).toMatchObject({ok:false,error:expect.stringMatching(/ABN/)});
 expect(rpc).not.toHaveBeenCalled();
});
it('persists normalized business details without filling absent fields with invented values',async()=>{
 rpc.mockClear();
 expect(await saveSettings({...input,legalName:' Example Pty Ltd ',abn:'51 824 753 556',dispatchNotes:'After confirmed payment.'})).toMatchObject({ok:true});
 const args=(rpc.mock.calls as unknown as [string,{p_values:Record<string,unknown>}][])[0][1];
 expect(args.p_values).toMatchObject({legal_name:'Example Pty Ltd',abn:'51824753556',dispatch_notes:'After confirmed payment.'});
 expect(args.p_values).not.toHaveProperty('public_address');
});
it('allows the ABN to be cleared',async()=>{
 rpc.mockClear();
 expect(await saveSettings({...input,abn:'   '})).toMatchObject({ok:true});
 const args=(rpc.mock.calls as unknown as [string,{p_values:Record<string,unknown>}][])[0][1];
 expect(args.p_values.abn).toBe('');
});
