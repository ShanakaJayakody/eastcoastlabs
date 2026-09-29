// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import RebrandExperience from '@/components/rebrand/RebrandExperience';
import ShopFilterGrid from '@/components/ShopFilterGrid';
import { CartProvider } from '@/lib/cart-context';
import { UIProvider } from '@/lib/ui-context';
import { labReports } from '@/lib/lab-reports';
import { searchProducts } from '../fixtures/product-search';

// Navigation is a framework boundary; retain real links for pointer selection.
const navigation=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>navigation}));
beforeEach(()=>{history.replaceState({},'', '/2');navigation.push.mockClear();});
afterEach(cleanup);

function homepage(products=searchProducts){
  return render(<CartProvider stock={{}}><UIProvider><RebrandExperience variant="v2" products={products} collections={[]} records={[]} report={labReports[0]} productReports={[]} reportCount={1} supportEmail="support@example.test"/></UIProvider></CartProvider>);
}

it('searches beyond the featured four and ranks the exact name before blends',()=>{
  homepage();
  const search=screen.getByRole('combobox',{name:'Search products'});
  fireEvent.change(search,{target:{value:'tesamorelin'}});
  expect(screen.getByRole('option',{name:/Tesamorelin/})).toHaveAttribute('href','/product/tesamorelin?rebrand=v2');
  fireEvent.change(search,{target:{value:'BPC157'}});
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('BPC-157');
  expect(screen.getAllByRole('option')[0]).toHaveAttribute('href','/product/bpc-157?rebrand=v2');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('From $65.00');
});

it('shows the exact size price and availability, then carries that size through keyboard selection',()=>{
  homepage();
  const search=screen.getByRole('combobox',{name:'Search products'});
  fireEvent.change(search,{target:{value:'BPC 5 mg'}});
  const option=screen.getByRole('option');
  expect(option).toHaveTextContent('5 mg');
  expect(option).toHaveTextContent('$45.00');
  expect(option).toHaveTextContent('Out of stock');
  expect(option).not.toHaveTextContent('15 mg');
  expect(option.querySelector('img')).toBeNull();
  expect(option).toHaveAttribute('href','/product/bpc-157?size=bpc-157-small&rebrand=v2');
  fireEvent.keyDown(search,{key:'ArrowDown'});
  expect(search).toHaveAttribute('aria-activedescendant',option.id);
  fireEvent.keyDown(search,{key:'Enter'});
  expect(navigation.push).toHaveBeenCalledWith('/product/bpc-157?size=bpc-157-small&rebrand=v2');
});

it('dismisses and restores suggestions without discarding the query',()=>{
  homepage();
  const search=screen.getByRole('combobox',{name:'Search products'});
  fireEvent.focus(search);
  fireEvent.change(search,{target:{value:'GHKCU'}});
  fireEvent.keyDown(search,{key:'Escape'});
  expect(search).toHaveAttribute('aria-expanded','false');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(search).toHaveValue('GHKCU');
  fireEvent.keyDown(search,{key:'ArrowDown'});
  expect(screen.getByRole('option')).toHaveTextContent('GHK-Cu');
  fireEvent.pointerDown(document.body);
  expect(search).toHaveAttribute('aria-expanded','false');
});

it('provides full results with the same query and a useful no-match recovery',()=>{
  homepage();
  const search=screen.getByRole('combobox',{name:'Search products'});
  fireEvent.change(search,{target:{value:'BPC 10 mg'}});
  expect(screen.getByRole('link',{name:/View all 1 result/})).toHaveAttribute('href','/shop?q=BPC+10+mg&rebrand=v2');
  fireEvent.keyDown(search,{key:'Enter'});
  expect(navigation.push).toHaveBeenLastCalledWith('/shop?q=BPC+10+mg&rebrand=v2');
  fireEvent.change(search,{target:{value:'no-such-compound'}});
  expect(screen.getByText('No products found')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Clear search'}));
  expect(search).toHaveValue('');
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(5);
});

it('focuses the finder from the header search control',()=>{
  homepage();
  fireEvent.click(screen.getByRole('link',{name:'Search peptides'}));
  expect(screen.getByRole('combobox',{name:'Search products'})).toHaveFocus();
});

it('distinguishes an unavailable catalogue from an unmatched query',()=>{
  homepage([]);
  fireEvent.focus(screen.getByRole('combobox',{name:'Search products'}));
  expect(screen.getByText(/Catalogue is temporarily unavailable/, {selector:'p'})).toBeInTheDocument();
  expect(screen.queryByText('No products found')).toBeNull();
});

it('keeps shop results consistent for compound-plus-size and punctuation-free searches',()=>{
  history.replaceState({},'', '/shop?q=BPC+5+mg&rebrand=v2');
  render(<ShopFilterGrid products={searchProducts} collections={[]} imageVariant="v2"/>);
  const cards=screen.getAllByRole('article');
  expect(cards).toHaveLength(1);
  expect(within(cards[0]).getByRole('link',{name:'BPC-157'})).toHaveAttribute('href','/product/bpc-157?rebrand=v2');
  fireEvent.change(screen.getByRole('searchbox',{name:'Search products'}),{target:{value:'ghkcu'}});
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('link',{name:'GHK-Cu'})).toBeInTheDocument();
});
