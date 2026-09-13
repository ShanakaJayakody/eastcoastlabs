// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const analytics=vi.hoisted(()=>({viewList:vi.fn()}));
vi.mock('@/lib/analytics',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/analytics')>(),trackViewItemList:analytics.viewList}));
import {ANALYTICS_CONSENT_COOKIE,setAnalyticsConsent} from '@/lib/attribution';
beforeEach(()=>{document.cookie=`${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`;});
afterEach(()=>{cleanup();analytics.viewList.mockClear();history.replaceState({},"","/");document.cookie=`${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;});
vi.mock('@/components/ProductCard',()=>({default:({product}:{product:{name:string}})=><p>{product.name}</p>}));
import type {CardProduct} from '@/components/ProductCard';
import ShopFilterGrid from '@/components/ShopFilterGrid';
const products=[{id:1,name:'Costly',slug:'a',sku:'A',prices:{price:'5000'},is_in_stock:false},{id:2,name:'Affordable',slug:'b',sku:'B',prices:{price:'1000'},is_in_stock:true}] as unknown as CardProduct[];
it('can filter to available products with a result count',()=>{render(<ShopFilterGrid products={products} collections={[]}/>);fireEvent.click(screen.getByLabelText('In stock only'));expect(screen.queryByText('Costly')).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('1 product');});
it('sorts products by current single price',()=>{render(<ShopFilterGrid products={products} collections={[]}/>);fireEvent.change(screen.getByLabelText('Sort products'),{target:{value:'price-asc'}});expect(screen.getByText('Affordable').compareDocumentPosition(screen.getByText('Costly')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();});
it('restores shareable stock and search filters from the URL',()=>{history.replaceState({},'', '/shop?q=Affordable&stock=1');render(<ShopFilterGrid products={products} collections={[]}/>);expect(screen.getByRole('searchbox')).toHaveValue('Affordable');expect(screen.getByLabelText('In stock only')).toBeChecked();expect(screen.queryByText('Costly')).toBeNull();history.replaceState({},'', '/');});
it('sorts sized products by their lowest purchasable size and keeps reset visible',()=>{
 const sized=[{...products[0],name:'Parent $79.99',is_in_stock:true,prices:{price:'7999'},sizes:[{id:1,slug:'parent',sku:'P-100',label:'100 mg',priceMinor:'7999',available:2,images:[],tiers:null},{id:2,slug:'child',sku:'P-50',label:'50 mg',priceMinor:'5999',available:2,images:[],tiers:null}]},{...products[1],name:'Flat $69.99',prices:{price:'6999'}}] as CardProduct[];
 render(<ShopFilterGrid products={sized} collections={[]}/>);
 fireEvent.change(screen.getByLabelText('Sort products'),{target:{value:'price-asc'}});
 expect(screen.getByText('Parent $79.99').compareDocumentPosition(screen.getByText('Flat $69.99')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByRole('button',{name:/reset filters/i})).toBeInTheDocument();
});
it('keeps catalogue categories behind a compact mobile filter control',()=>{
 render(<ShopFilterGrid products={products} collections={[{slug:'recovery',name:'Recovery',icon:'R',tagline:'Recovery research',description:'',products:['b']}]}/>);
 const toggle=screen.getByRole('button',{name:/product categories/i});
 expect(toggle).toHaveAttribute('aria-expanded','false');
 fireEvent.click(toggle);
 expect(toggle).toHaveAttribute('aria-expanded','true');
});
it('measures the visible shop list with canonical catalogue slugs',()=>{
 render(<ShopFilterGrid products={products} collections={[]}/>);
 expect(analytics.viewList).toHaveBeenCalledWith([
  expect.objectContaining({item_id:'a',item_name:'Costly',price:50}),
  expect.objectContaining({item_id:'b',item_name:'Affordable',price:10}),
 ],'shop','Shop');
});
it('measures the mounted visible list when analytics is allowed on the same page',async()=>{
 document.cookie=`${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;
 render(<ShopFilterGrid products={products} collections={[]}/>);
 expect(analytics.viewList).not.toHaveBeenCalled();
 setAnalyticsConsent('granted');
 await waitFor(()=>expect(analytics.viewList).toHaveBeenCalledWith([
  expect.objectContaining({item_id:'a'}),expect.objectContaining({item_id:'b'}),
 ],'shop','Shop'));
});
