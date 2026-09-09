import {expect,it,vi} from 'vitest';
const from=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from})}));
import {lookupOrder} from '@/app/(store)/leave-a-review/actions';
it('does not look up private purchase data using an unsigned order reference',async()=>{
 await expect(lookupOrder('ECL-1000')).resolves.toMatchObject({ok:false});
 expect(from).not.toHaveBeenCalled();
});
