// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RebrandLink from '@/components/rebrand/RebrandLink';

const route=vi.hoisted(()=>({pathname:'/product/ghk-cu',query:'rebrand=v2&size=50'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.pathname,useSearchParams:()=>new URLSearchParams(route.query)}));
afterEach(cleanup);

it('keeps a valid design on shared shop, search and cart product links',()=>{
 render(<><RebrandLink href="/shop#catalog-search">Search</RebrandLink><RebrandLink href="/product/ghk-cu?size=child">Product</RebrandLink></>);
 expect(screen.getByRole('link',{name:'Search'})).toHaveAttribute('href','/shop?rebrand=v2#catalog-search');
 expect(screen.getByRole('link',{name:'Product'})).toHaveAttribute('href','/product/ghk-cu?size=child&rebrand=v2');
});
it('uses the landing-page design for its shared cart navigation',()=>{
 route.pathname='/3'; route.query='';
 render(<RebrandLink href="/shop">Shop</RebrandLink>);
 expect(screen.getByRole('link',{name:'Shop'})).toHaveAttribute('href','/shop?rebrand=v3');
});
it('preserves original links outside a valid rebrand session',()=>{
 route.pathname='/'; route.query='rebrand=unknown';
 render(<RebrandLink href="/shop">Shop</RebrandLink>);
 expect(screen.getByRole('link',{name:'Shop'})).toHaveAttribute('href','/shop');
});
