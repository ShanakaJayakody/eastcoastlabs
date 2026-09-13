import { beforeEach, expect, it, vi } from 'vitest';
const fixtures=vi.hoisted(()=>({threshold:0}));
vi.mock('@/lib/settings',()=>({getSettings:async()=>({giftThreshold:fixtures.threshold})}));
vi.mock('@/lib/admin/inventory',()=>({getAvailability:async()=>({available:20})}));
vi.mock('@/lib/stacks',()=>({getStackBySlug:async()=>null}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{
  const rows=[{id:'paid',price_cents:1000,pack_size:1,active:true,label:'1 vial',products:{slug:'sample',name:'Sample',status:'active'}},
    {id:'water',price_cents:2000,pack_size:1,active:true,label:'1 vial',products:{slug:'bacteriostatic-water',name:'Water',status:'active'}}];
  let filtered=rows;
  const value=(row:typeof rows[number],key:string)=>key.startsWith('products.')?row.products[key.slice(9) as keyof typeof row.products]:row[key as keyof typeof row];
  const q={select:()=>q,in:(key:string,values:unknown[])=>{filtered=filtered.filter(r=>values.includes(value(r,key)));return q;},
    eq:(key:string,want:unknown)=>{filtered=filtered.filter(r=>value(r,key)===want);return q;},
    maybeSingle:async()=>({data:filtered[0]??null,error:null}),
    then:(fn:(result:{data:typeof rows;error:null})=>unknown)=>Promise.resolve({data:filtered,error:null}).then(fn)};
  return q;
}})}));
import { resolveCart } from '@/lib/checkout';
import * as checkout from '@/lib/checkout';
const gift={key:'gift:bac-water',slug:'bacteriostatic-water',variantLabel:'Free gift',quantity:1};
beforeEach(()=>{fixtures.threshold=0;});
it('rejects a gift-only request even when the configured threshold is zero',async()=>{
  const cart=await resolveCart([gift]);
  expect(cart.giftApplied).toBe(false);
  expect(cart.items).toEqual([]);
});
it('does not let a removed or forged paid line qualify a gift',async()=>{
  const cart=await resolveCart([{key:'missing',slug:'missing',variantLabel:'1 vial',quantity:1},gift]);
  expect(cart.giftApplied).toBe(false);
  expect(cart.items).toEqual([]);
});
it('still grants one stock-backed gift for a genuine qualifying purchase',async()=>{
  const cart=await resolveCart([{key:'sample',slug:'sample',variantLabel:'1 vial',quantity:1},gift]);
  expect(cart.giftApplied).toBe(true);
  expect(cart.items).toEqual([{variantId:'paid',qty:1,expectedPriceCents:1000},{variantId:'water',qty:1,priceOverrideCents:0,labelSuffix:' · Free gift'}]);
});
it('derives the automatic gift for a qualifying restored cart without a client gift line',async()=>{
  fixtures.threshold=10;
  const cart=await resolveCart([{key:'sample',slug:'sample',variantLabel:'1 vial',quantity:1}]);
  expect(cart.giftApplied).toBe(true);
  expect(cart.lines.find(line=>line.isGift)).toMatchObject({key:'gift:bac-water',slug:'bacteriostatic-water',quantity:1,lineTotalCents:0});
  expect(cart.items).toHaveLength(2);
});
it('removes only the threshold gift after a discount takes the basket below eligibility',async()=>{
  const original=await resolveCart([{key:'sample',slug:'sample',variantLabel:'1 vial',quantity:1},gift]);
  original.items.unshift({variantId:'water',qty:1,priceOverrideCents:0,labelSuffix:' · Sample stack (included)'});
  const apply=(checkout as typeof checkout & {applyGiftThreshold:(cart:typeof original,subtotal:number,threshold:number)=>typeof original}).applyGiftThreshold;
  const result=apply(original,900,1000);
  expect(result.giftApplied).toBe(false);
  expect(result.lines.some(line=>line.isGift)).toBe(false);
  expect(result.items).toEqual([{variantId:'water',qty:1,priceOverrideCents:0,labelSuffix:' · Sample stack (included)'},{variantId:'paid',qty:1,expectedPriceCents:1000}]);
  expect(original.giftApplied).toBe(true);
});
