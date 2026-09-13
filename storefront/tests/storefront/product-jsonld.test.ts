import { expect, it } from 'vitest';
import { buildProductJsonLd, serializeProductJsonLd } from '@/lib/product-jsonld';

it('describes each purchasable size and pack with its real SKU, price, stock and deep link',()=>{
 const json=buildProductJsonLd({name:'GHK-Cu',slug:'ghk-cu',sku:'GHK-100',description:'Copper peptide',currency:'AUD',images:['/ghk.png'],sizes:[
  {slug:'ghk-cu',sku:'GHK-100',label:'100 mg',available:2,priceMinor:'7999',tiers:[{id:'single',label:'1 vial',vials:1,total:79.99,perVial:79.99}]},
  {slug:'ghk-cu-50',sku:'GHK-50',label:'50 mg',available:0,priceMinor:'5999',tiers:[{id:'single',label:'1 vial',vials:1,total:59.99,perVial:59.99},{id:'pack3',label:'3-pack',vials:3,total:159.99,perVial:53.33}]},
 ]});
 expect(json).toMatchObject({'@type':'ProductGroup',productGroupID:'ghk-cu',variesBy:'https://schema.org/size'});
 if (!('hasVariant' in json)) throw new Error('expected ProductGroup variants');
 expect(json.hasVariant).toEqual([
  expect.objectContaining({sku:'GHK-100',size:'100 mg',offers:[expect.objectContaining({price:'79.99',availability:'https://schema.org/InStock',url:'https://www.eastcoastlabs.com.au/product/ghk-cu?size=ghk-cu'})]}),
  expect.objectContaining({sku:'GHK-50',size:'50 mg',offers:[expect.objectContaining({price:'59.99',availability:'https://schema.org/OutOfStock'}),expect.objectContaining({price:'159.99',availability:'https://schema.org/OutOfStock'})]}),
 ]);
});

it('serializes dynamic catalogue text without allowing an inline script boundary',()=>{
 expect(serializeProductJsonLd({'@type':'Product',description:'</script><script>alert(1)</script>'})).toBe('{"@type":"Product","description":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}');
});
