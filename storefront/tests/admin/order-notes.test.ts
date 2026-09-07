import {it,expect,vi} from 'vitest';
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'operator@test.local'})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/admin/audit',()=>({logAudit:async()=>{throw Error('Audit must not follow a rejected note');}}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>({insert:async()=>({error:{message:'Note insert rejected'}})})})}));
import {addNote} from '@/app/admin/(dashboard)/orders/actions';
it('a rejected note insert returns failure instead of a success audit and clearing the editor',async()=>{
 expect(await addNote('order','Keep my note')).toEqual({ok:false,error:'Note insert rejected'});
});
