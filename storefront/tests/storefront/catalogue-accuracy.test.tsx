// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('next/image',()=>({default:(props:{src:string;alt:string})=><img src={props.src} alt={props.alt}/>}));
const analytics=vi.hoisted(()=>({select:vi.fn()}));
vi.mock('@/lib/analytics',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/analytics')>(),trackSelectItem:analytics.select}));

import ProductCard from '@/components/ProductCard';
import ProductDescription from '@/components/ProductDescription';
import { normalizeProductSizeLabel, purchasableStartingPriceMinor } from '@/lib/product-sizes';

afterEach(()=>{cleanup();analytics.select.mockClear();});

const sizedProduct={
 id:1,name:'GHK-Cu',slug:'ghk-cu',sku:'GHK-100',is_in_stock:true,images:[],
 prices:{price:'7999',regular_price:'7999',sale_price:'',currency_code:'AUD',currency_minor_unit:2,currency_prefix:'$',currency_suffix:''},
 sizes:[
  {id:1,slug:'ghk-cu',sku:'GHK-100',label:'100',priceMinor:'7999',available:3,images:[],tiers:null},
  {id:2,slug:'ghk-cu-50',sku:'GHK-50',label:'50',priceMinor:'5999',available:4,images:[],tiers:null},
 ],
} as const;

it('uses the lowest purchasable size price and displays full unit labels with deep links',()=>{
 expect(purchasableStartingPriceMinor(sizedProduct.sizes,'7999')).toBe(5999);
 expect(normalizeProductSizeLabel('50')).toBe('50 mg');
 render(<ProductCard product={sizedProduct as never}/>);
 expect(screen.getByText(/From \$59\.99/)).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'50 mg'})).toHaveAttribute('href','/product/ghk-cu?size=ghk-cu-50');
 expect(screen.getByRole('link',{name:'100 mg'})).toHaveAttribute('href','/product/ghk-cu?size=ghk-cu');
});

it('ignores a sold-out cheaper size when calculating the purchasable starting price',()=>{
 expect(purchasableStartingPriceMinor([{...sizedProduct.sizes[0]},{...sizedProduct.sizes[1],available:0}],'7999')).toBe(7999);
});

it('measures a shop-card choice with the same size-aware starting price',()=>{
 render(<ProductCard product={sizedProduct as never} listId="shop" listName="Shop"/>);
 const link=screen.getByRole('link',{name:'GHK-Cu'});
 link.addEventListener('click',(event)=>event.preventDefault(),{once:true});
 fireEvent.click(link);
 expect(analytics.select).toHaveBeenCalledWith(expect.objectContaining({item_id:'ghk-cu',item_name:'GHK-Cu',price:59.99}),'shop','Shop');
});

it('renders structured product copy and safe links without activating unsafe URLs',()=>{
 render(<ProductDescription html={'<h3>Specifications</h3><p>50 mg &#8211; research vial &amp; cap.</p><p><a href="https://example.test/report.pdf">Batch report</a> <a href="javascript:alert(1)">Unsafe report</a></p><script>alert(2)</script>'}/>);
 expect(screen.getByRole('heading',{name:'Specifications'})).toBeInTheDocument();
 expect(screen.getByText('50 mg – research vial & cap.')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Batch report'})).toHaveAttribute('href','https://example.test/report.pdf');
 expect(screen.queryByRole('link',{name:'Unsafe report'})).toBeNull();
 expect(screen.getByText('Unsafe report')).toBeInTheDocument();
 expect(screen.queryByText(/alert\(2\)/)).toBeNull();
});

it('preserves natural spacing and unwrapped copy around safe inline links and blocks',()=>{
 render(<ProductDescription html={'Intro text. <p>Read <a href="/lab-results">certificate</a> now.</p> Outro text.'}/>);
 expect(screen.getByText('Intro text.')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'certificate'}).closest('p')).toHaveTextContent('Read certificate now.');
 expect(screen.getByText('Outro text.')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'certificate'})).toHaveAttribute('href','/lab-results');
});

it('rejects root-looking URLs containing backslashes or control characters',()=>{
 render(<ProductDescription html={'<p><a href="/\\evil.example">Backslash escape</a> <a href="/safe\npath">Control escape</a></p>'}/>);
 expect(screen.queryByRole('link',{name:'Backslash escape'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Control escape'})).toBeNull();
 expect(screen.getByText(/Backslash escape/)).toBeInTheDocument();
});
