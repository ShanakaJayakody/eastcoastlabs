import {expect,it,vi} from 'vitest';
vi.mock('@/lib/catalog',()=>({getCatalog:()=>Promise.resolve({products:[{slug:'bpc-157',name:'BPC',prices:{price:'10001'},available:2,is_in_stock:true},{slug:'tb-500',name:'TB',prices:{price:'5555'},available:0,is_in_stock:false}]})}));
import {getStacks} from '@/lib/stacks';
it('uses current cents and the limiting component availability',async()=>{const stacks=await getStacks();const s=stacks.find(s=>s.components.some(c=>c.slug==='bpc-157')&&s.components.some(c=>c.slug==='tb-500'))!;expect(s.componentsTotal).toBe(155.56);expect(s.bundlePrice).toBe(Math.round(15556*(1-s.discountPct/100))/100);expect(s.available).toBe(0);});
