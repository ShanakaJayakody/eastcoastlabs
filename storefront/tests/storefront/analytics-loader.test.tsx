// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
afterEach(cleanup);
const m=vi.hoisted(()=>({path:'/shop'}));
vi.mock('@/lib/env',()=>({GA4_ID:'G-TEST'}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path}));
vi.mock('next/web-vitals',()=>({useReportWebVitals:()=>{}}));
vi.mock('next/script',()=>({default:({src}:{src:string})=><span data-testid='analytics-loader'>{src}</span>}));
import Analytics from '@/components/Analytics';
beforeEach(()=>{m.path='/shop';history.replaceState({},'', '/shop');window.gtag=vi.fn();});
it.each(['/pay/order','/checkout/thank-you','/leave-a-review','/admin','/subscribe-confirm','/unsubscribe'])('does not load third-party analytics on %s',path=>{m.path=path;history.replaceState({},'',path+'?token=secret');render(<Analytics/>);expect(screen.queryByTestId('analytics-loader')).toBeNull();expect(window.gtag).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
it('uses only sanitized public URL and no private referrer during initialization',()=>{history.replaceState({},'', '/shop?email=private@example.test&token=secret');Object.defineProperty(document,'referrer',{configurable:true,value:'https://eastcoastlabs.com.au/pay/uuid?token=bearer'});const sender=vi.fn();window.gtag=sender;render(<Analytics/>);const calls=JSON.stringify(sender.mock.calls);expect(calls).not.toMatch(/private@|secret|bearer|uuid/);expect(sender).toHaveBeenCalledWith('config','G-TEST',expect.objectContaining({page_location:'http://localhost:3000/shop',page_referrer:'',send_page_view:false}));});
import MarketingOnly from '@/components/MarketingOnly';
it.each(['/checkout','/pay/order','/checkout/thank-you','/cart'])('suppresses newsletter capture on transaction route %s',path=>{m.path=path;render(<MarketingOnly><p>Newsletter form</p></MarketingOnly>);expect(screen.queryByText('Newsletter form')).toBeNull();});
