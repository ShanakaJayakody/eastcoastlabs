// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
afterEach(()=>{cleanup();history.replaceState({},"","/");});
vi.mock('@/components/ProductCard',()=>({default:({product}:{product:{name:string}})=><p>{product.name}</p>}));
import type {CardProduct} from '@/components/ProductCard';
import ShopFilterGrid from '@/components/ShopFilterGrid';
const products=[{id:1,name:'Costly',slug:'a',sku:'A',prices:{price:'5000'},is_in_stock:false},{id:2,name:'Affordable',slug:'b',sku:'B',prices:{price:'1000'},is_in_stock:true}] as unknown as CardProduct[];
it('can filter to available products with a result count',()=>{render(<ShopFilterGrid products={products} collections={[]}/>);fireEvent.click(screen.getByLabelText('In stock only'));expect(screen.queryByText('Costly')).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('1 product');});
it('sorts products by current single price',()=>{render(<ShopFilterGrid products={products} collections={[]}/>);fireEvent.change(screen.getByLabelText('Sort products'),{target:{value:'price-asc'}});expect(screen.getByText('Affordable').compareDocumentPosition(screen.getByText('Costly')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();});
it('restores shareable stock and search filters from the URL',()=>{history.replaceState({},'', '/shop?q=Affordable&stock=1');render(<ShopFilterGrid products={products} collections={[]}/>);expect(screen.getByRole('searchbox')).toHaveValue('Affordable');expect(screen.getByLabelText('In stock only')).toBeChecked();expect(screen.queryByText('Costly')).toBeNull();history.replaceState({},'', '/');});
