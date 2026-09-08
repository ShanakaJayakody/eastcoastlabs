import { describe,it,expect,vi,beforeEach } from 'vitest';
type VariantFixture = { id: string; price_cents: number; pack_size: number; active: boolean; label: string; products: { slug: string; name: string; status: string } };
type StackFixture = { name: string; bundlePriceCents: number; components: { slug: string; name: string }[]; freeBacWater: boolean };
const fixture=vi.hoisted(()=>({rows:[] as VariantFixture[], stack:null as StackFixture|null}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{
 let rows=fixture.rows;
 const q={select:()=>q,in:()=>q,eq:(key:string,value:unknown)=>{rows=rows.filter(r=>key==='active'?r.active===value:key==='products.status'?r.products.status===value:true);return q},then:(f:(result:{data:VariantFixture[];error:null})=>unknown)=>Promise.resolve({data:rows,error:null}).then(f)};
 return q;
}})}));
vi.mock('@/lib/settings',()=>({getSettings:async()=>({giftThreshold:200})}));
vi.mock('@/lib/stacks',()=>({getStackBySlug:async()=>fixture.stack}));
import {resolveCart} from '@/lib/checkout';
beforeEach(()=>{fixture.stack=null;fixture.rows=[{id:'variant',price_cents:1000,pack_size:1,active:true,label:'1 vial',products:{slug:'sample',name:'Sample',status:'active'}}]});
describe('authoritative cart eligibility',()=>{
 it('treats saved subscribe labels as one-time purchases at the full price',async()=>{
  const result=await resolveCart([{key:'sample:sub',slug:'sample',variantLabel:'1 vial · Subscribe',quantity:2}]);
  expect(result.subtotalCents).toBe(2000);expect(result.items[0].discountPct??0).toBe(0);
 });
 it('does not resolve a variant belonging to an archived parent',async()=>{
  fixture.rows[0].products.status='archived';
  const result=await resolveCart([{key:'sample',slug:'sample',variantLabel:'1 vial',quantity:1}]);
  expect(result.items).toEqual([]);expect(result.warnings.length).toBeGreaterThan(0);
 });
 it('does not turn an inactive accessory into an unstocked sale',async()=>{
  fixture.rows=[];const result=await resolveCart([{key:'alcohol-swabs',slug:'alcohol-swabs',variantLabel:'100 pack',quantity:1}]);
  expect(result.extraItems).toEqual([]);expect(result.warnings.length).toBeGreaterThan(0);
 });
 it('keeps zero-priced bundle components in integer cents',async()=>{
  fixture.rows[0].price_cents=0;
  fixture.rows.push({...fixture.rows[0],id:'other',products:{slug:'other',name:'Other',status:'active'}});
  fixture.stack={name:'Sample bundle',bundlePriceCents:0,freeBacWater:false,components:[{slug:'sample',name:'Sample'},{slug:'other',name:'Other'}]};
  const result=await resolveCart([{key:'stack:sample',slug:'sample',variantLabel:'Bundle',quantity:1}]);
  expect(result.subtotalCents).toBe(0);expect(result.items.map(i=>i.priceOverrideCents)).toEqual([0,0]);
 });

});

it('prefers an explicit live identity even when its display label changed',async()=>{
 fixture.rows.push({...fixture.rows[0],id:'three',pack_size:3,price_cents:2500,label:'3-pack'});
 const r=await resolveCart([{key:'sample',slug:'sample',variantId:'three',variantLabel:'old display',quantity:1}]);
 expect(r.items[0].variantId).toBe('three');expect(r.subtotalCents).toBe(2500);
});
it('never falls back from an explicit invalid, inactive or mismatched identity',async()=>{
 fixture.rows.push({...fixture.rows[0],id:'other',products:{slug:'other',name:'Other',status:'active'}});
 for(const variantId of ['missing','other','']) {
  const r=await resolveCart([{key:'sample',slug:'sample',variantId,variantLabel:'1 vial',quantity:1}]);
  expect(r.items).toEqual([]);
 }
 fixture.rows[0].active=false;
 expect((await resolveCart([{key:'sample',slug:'sample',variantId:'variant',variantLabel:'1 vial',quantity:1}])).items).toEqual([]);
});
it('does not reinterpret explicit variant identities as bundle or gift lines',async()=>{
 fixture.stack={name:'Sample bundle',bundlePriceCents:1000,freeBacWater:false,components:[{slug:'sample',name:'Sample'}]};
 const r=await resolveCart([{key:'stack:sample',slug:'sample',variantId:'variant',variantLabel:'1 vial',quantity:1}]);
 expect(r.items).toEqual([]);expect(r.warnings.length).toBeGreaterThan(0);
});
