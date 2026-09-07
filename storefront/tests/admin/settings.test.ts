import {it,expect,vi} from 'vitest';
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'operator@test.local'})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:()=>{throw Error('Unexpected persistence');},rpc:async()=>({data:1,error:null})})}));
import {saveSettings} from '@/app/admin/(dashboard)/settings/actions';
const input={announcementItems:['Hello'],freeShippingThreshold:0,giftThreshold:0,supportEmail:'valid@test.local',payidEnabled:true,payidIdentifier:'valid@test.local',payidName:'Test',bankTransferEnabled:false,bankBsb:'',bankAccountNumber:'',bankAccountName:'',paymentWindowHours:24,paymentExpiryHours:48,standardShippingCents:0,expressShippingEnabled:false,expressShippingCents:0,expressFreeThreshold:0};
it.each([NaN,Infinity,-1,0.5])('rejects invalid shipping cents %s before persistence',async value=>{
 expect(await saveSettings({...input,standardShippingCents:value})).toMatchObject({ok:false,error:expect.stringMatching(/shipping/i)});
});
it.each([NaN,Infinity,-1,0,721])('rejects invalid hold hours %s before persistence',async value=>{
 expect(await saveSettings({...input,paymentWindowHours:value})).toMatchObject({ok:false,error:expect.stringMatching(/hold|window/i)});
});
