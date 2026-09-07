import {expect,it,vi} from 'vitest';
vi.mock('@/lib/reviews',()=>({getAggregates:()=>({})}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:()=>({select:()=>({in:()=>Promise.resolve({data:[{slug:'inactive',status:'archived',product_variants:[{pack_size:1,active:true,inventory:{on_hand:9,reserved:0}}]},{slug:'active',status:'active',product_variants:[{pack_size:1,active:false,inventory:{on_hand:9,reserved:0}},{pack_size:3,active:true,inventory:{on_hand:9,reserved:0}}]}],error:null})})})})}));
import {getAvailabilityMap} from '@/lib/storefront-catalog';
it('keeps missing, archived and disabled pool items unavailable',async()=>{expect(await getAvailabilityMap(['inactive','active','missing'])).toEqual({inactive:0,active:0,missing:0});});
