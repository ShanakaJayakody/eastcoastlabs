import {expect, it, vi} from 'vitest';
import {getStacks} from '@/lib/stacks';

vi.mock('@/lib/catalog',()=>({getCatalog:async()=>({products:[
  {slug:'ghk-cu',name:'GHK-Cu',prices:{price:'8000'},available:4,images:[{src:'/original-100.webp'}],sizes:[
    {slug:'ghk-cu',label:'100 mg',available:0},
    {slug:'ghk-cu-small',label:'50 mg',available:4},
  ]},
  {slug:'glow',name:'GLOW',prices:{price:'9000'},available:5,images:[{src:'/original-glow.webp'}]},
]})}));

it('uses the stack’s original strength even when another strength is available',async()=>{
  const [plain] = await getStacks();
  const [navy] = await getStacks('v2');
  expect(navy.components[0]).toMatchObject({name:'GHK-Cu · 100 mg',available:0,image:'/images/rebrand/vials/v2/ghk-cu.webp'});
  expect(navy.available).toBe(0);
  expect(navy.bundlePriceCents).toBe(plain.bundlePriceCents);
  expect(plain.components[0].image).toBe('/original-100.webp');
});
