// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BuyBox from '@/components/BuyBox';
import CartDrawer from '@/components/CartDrawer';
import { CartProvider } from '@/lib/cart-context';
import { UIProvider } from '@/lib/ui-context';

let observerCallback: IntersectionObserverCallback;
let target: Element;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
    observe(element: Element) { target = element; }
    disconnect() {}
  });
});
afterEach(cleanup);
function visibility(top: number, visible: boolean) {
  vi.spyOn(target,'getBoundingClientRect').mockReturnValue({top,bottom:top+56,height:56,width:200,left:0,right:200,x:0,y:top,toJSON:()=>({})});
  act(() => observerCallback([{ target, isIntersecting: visible, intersectionRatio:visible ? 1 : 0, boundingClientRect: { top } } as IntersectionObserverEntry], {} as IntersectionObserver));
}
function purchase() {
  return render(<CartProvider stock={{'bacteriostatic-water':0}}><UIProvider>
    <BuyBox product={{id:1,name:'Sample',slug:'sample',sku:'SAMPLE'}} sizeLabel="20 mg" available={4} minorUnit={2} singlePriceMinor="2000"
      tiers={[{id:'single',label:'1 vial',vials:1,total:20,perVial:20},{id:'pack3',label:'3-pack',vials:3,total:54,perVial:18}]} />
    <CartDrawer />
  </UIProvider></CartProvider>);
}
it('offers option selection before the buy controls and hides the duplicate action while they are visible', async () => {
  purchase();
  visibility(1000, false);
  await waitFor(() => expect(screen.getByRole('button', {name:'Choose options'})).toBeVisible());
  fireEvent.click(screen.getByRole('button', {name:'Choose options'}));
  expect(document.activeElement).toHaveAttribute('aria-label', 'Purchase options');
  expect(screen.queryByRole('dialog')).toBeNull();
  visibility(200, true);
  await waitFor(() => expect(screen.queryByRole('region', {name:'Quick purchase'})).toBeNull());
});
it('adds the selected pack from the scrolled action and suppresses it while the cart is open', async () => {
  purchase();
  fireEvent.click(screen.getByRole('radio', {name:/3-pack/}));
  visibility(-200, false);
  await waitFor(() => expect(screen.getByRole('region', {name:'Quick purchase'})).toHaveTextContent('3-pack · 20 mg'));
  expect(screen.getByRole('region', {name:'Quick purchase'})).toHaveTextContent('$54.00');
  fireEvent.click(screen.getByRole('button', {name:'Add to Cart'}));
  expect(screen.getByRole('dialog', {name:'Shopping cart'})).toHaveTextContent('3-pack · 20 mg');
  expect(screen.queryByRole('region', {name:'Quick purchase'})).toBeNull();
});
