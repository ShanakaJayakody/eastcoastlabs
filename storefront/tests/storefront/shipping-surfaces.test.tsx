// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DEFAULT_SETTINGS, getSettings } from '@/lib/settings';
import { shippingRules } from '@/lib/shipping-policy';
import { quoteShipping } from '@/lib/shipping';
import AnnouncementBar from '@/components/AnnouncementBar';
import ShippingPage from '@/app/(store)/shipping/page';
import CartContents from '@/components/CartContents';
import PurchaseReassurance from '@/components/PurchaseReassurance';
import { CartProvider } from '@/lib/cart-context';

vi.mock('@/lib/settings', async importOriginal => ({...await importOriginal<typeof import('@/lib/settings')>(), getSettings:vi.fn()}));
afterEach(() => {cleanup();localStorage.clear();});

it.each([0,1000])('keeps the cart, product, announcement and policy consistent with a %s-cent standard rate', async rate => {
  const settings = {...DEFAULT_SETTINGS, standardShippingCents:rate, expressShippingEnabled:false,
    announcementItems:['Research use only','Free standard $500+ · express $700+']};
  vi.mocked(getSettings).mockResolvedValue(settings);
  localStorage.setItem('ecl_cart_v1',JSON.stringify([{key:'sample:single',productId:1,name:'Sample',slug:'sample',variantLabel:'1 vial',unitPrice:50,quantity:1}]));
  render(<>
    <section aria-label="Announcement">{await AnnouncementBar()}</section>
    <section aria-label="Policy">{await ShippingPage()}</section>
    <CartProvider shipping={shippingRules(settings)} paymentLabels={['PayID']} thresholds={{freeShipping:500,gift:250}} stock={{'bacteriostatic-water':0}}>
      <section aria-label="Product reassurance"><PurchaseReassurance/></section>
      <section aria-label="Cart"><CartContents/></section>
    </CartProvider>
  </>);
  const expected = rate === 0 ? 'Standard shipping included' : 'Standard shipping $10.00 · free from $150.00';
  for (const area of ['Policy','Product reassurance','Cart']) {
    const region=within(screen.getByRole('region',{name:area}));
    expect(region.getAllByText(expected,{exact:false})[0]).toBeVisible();
    expect(region.queryByText(/express/i)).toBeNull();
  }
  const announcement=screen.getByRole('region',{name:'Announcement'});
  expect(announcement).toHaveTextContent(rate === 0 ? 'Standard shipping included' : 'Free standard $150+');
  expect(announcement).not.toHaveTextContent('$500');
  expect(quoteShipping(5000, settings)[0].cents).toBe(rate);
  const cart=within(screen.getByRole('region',{name:'Cart'}));
  expect(cart.queryByText(/\$450/)).toBeNull();
  if (rate === 0) expect(cart.queryByText(/from free standard/i)).toBeNull();
  expect(cart.getByText(/Pay by PayID/)).toBeVisible();
});

it.each([true,false])('keeps express reward milestones aligned with checkout when enabled=%s', enabled => {
  const settings = {...DEFAULT_SETTINGS, standardShippingCents:1000,
    expressShippingEnabled:enabled, expressShippingCents:0, expressFreeThreshold:200};
  localStorage.setItem('ecl_cart_v1',JSON.stringify([{key:'sample:single',productId:1,name:'Sample',slug:'sample',variantLabel:'1 vial',unitPrice:50,quantity:1}]));
  render(<CartProvider shipping={shippingRules(settings)} paymentLabels={['PayID']}
    thresholds={{freeShipping:100,gift:250,express:700}} stock={{'bacteriostatic-water':0}}>
    <CartContents/>
  </CartProvider>);
  const rewards=within(screen.getByRole('region',{name:'Cart rewards'}));
  if (enabled) {
    expect(rewards.getByText('Free Express shipping')).toBeVisible();
    expect(rewards.getByText('$0+')).toBeVisible();
    expect(quoteShipping(5000,settings).find(rule=>rule.method==='express')?.cents).toBe(0);
  } else expect(rewards.queryByText('Free Express shipping')).toBeNull();
  expect(rewards.queryByText('$700+')).toBeNull();
});
