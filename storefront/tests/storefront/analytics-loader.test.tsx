// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
afterEach(cleanup);
const m=vi.hoisted(()=>({path:'/shop'}));
vi.mock('@/lib/env',()=>({GA4_ID:'G-TEST'}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path}));
vi.mock('next/web-vitals',()=>({useReportWebVitals:()=>{}}));
vi.mock('next/script',()=>({default:({src}:{src:string})=><span data-testid='analytics-loader'>{src}</span>}));
import Analytics from '@/components/Analytics';
import AnalyticsConsentControls from '@/components/AnalyticsConsentControls';
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_CAMPAIGNS','launch');m.path='/shop';history.replaceState({},'', '/shop');document.cookie='ecl_analytics_consent=granted; Path=/';document.cookie='ecl_measurement=; Max-Age=0; Path=/';window.gtag=vi.fn();});
it.each(['/pay/order','/checkout/thank-you','/leave-a-review','/admin','/subscribe-confirm','/unsubscribe','/creators/privacy'])('does not load third-party analytics on %s',path=>{m.path=path;history.replaceState({},'',path+'?token=secret');render(<Analytics/>);expect(screen.queryByTestId('analytics-loader')).toBeNull();expect(window.gtag).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
it('uses only sanitized public URL and no private referrer during initialization',async()=>{history.replaceState({},'', '/shop?email=private@example.test&token=secret');Object.defineProperty(document,'referrer',{configurable:true,value:'https://eastcoastlabs.com.au/pay/uuid?token=bearer'});const sender=vi.fn();window.gtag=sender;render(<Analytics/>);await waitFor(()=>expect(sender).toHaveBeenCalledWith('config','G-TEST',expect.objectContaining({page_location:'http://localhost:3000/shop',page_referrer:'',send_page_view:false})));const calls=JSON.stringify(sender.mock.calls);expect(calls).not.toMatch(/private@|secret|bearer|uuid/);});
import MarketingOnly from '@/components/MarketingOnly';
it('loads analytics on the creator landing page with a sanitized URL',async()=>{m.path='/creators';history.replaceState({},'', '/creators?email=private@example.test#apply');const sender=vi.fn();window.gtag=sender;render(<Analytics/>);expect(await screen.findByTestId('analytics-loader')).toHaveTextContent('G-TEST');await waitFor(()=>expect(sender).toHaveBeenCalledWith('config','G-TEST',expect.objectContaining({page_location:'http://localhost:3000/creators'})));expect(JSON.stringify(sender.mock.calls)).not.toContain('private@example.test');});
it.each(['/checkout','/pay/order','/checkout/thank-you','/cart','/creators','/creators/privacy'])('suppresses newsletter capture on transaction route %s',path=>{m.path=path;render(<MarketingOnly><p>Newsletter form</p></MarketingOnly>);expect(screen.queryByText('Newsletter form')).toBeNull();});
it('does not load or retain attribution before a visitor grants analytics consent',()=>{
 document.cookie='ecl_analytics_consent=; Max-Age=0; Path=/';history.replaceState({},'','/shop?utm_source=google&utm_medium=cpc&utm_campaign=launch&email=private@example.test');
 render(<Analytics/>);
 expect(screen.queryByTestId('analytics-loader')).toBeNull();expect(window.gtag).not.toHaveBeenCalled();expect(document.cookie).not.toContain('ecl_measurement');
 expect(screen.getByRole('region',{name:'Analytics choices'})).toBeVisible();
});
it('loads after explicit acceptance and stores only allowlisted first-party acquisition',async()=>{
 document.cookie='ecl_analytics_consent=; Max-Age=0; Path=/';history.replaceState({},'','/shop?utm_source=google&utm_medium=cpc&utm_campaign=launch&email=private@example.test');
 render(<Analytics/>);fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
 await screen.findByTestId('analytics-loader');await waitFor(()=>expect(window.gtag).toHaveBeenCalledWith('config','G-TEST',expect.any(Object)));
 expect(decodeURIComponent(document.cookie)).toContain('"source":"google"');expect(decodeURIComponent(document.cookie)).not.toMatch(/private@|email/);
});
it('keeps analytics disabled and removes measurement state after decline',()=>{
 document.cookie='ecl_analytics_consent=; Max-Age=0; Path=/';document.cookie=`ecl_measurement=${encodeURIComponent(JSON.stringify({acquisition:{source:'google',landingPath:'/shop'},experiments:[]}))}; Path=/`;
 render(<Analytics/>);fireEvent.click(screen.getByRole('button',{name:'Decline analytics'}));
 expect(screen.queryByTestId('analytics-loader')).toBeNull();expect(document.cookie).toContain('ecl_analytics_consent=denied');expect(document.cookie).not.toContain('ecl_measurement');
});
it('lets the privacy-page control withdraw consent and stop the active loader',async()=>{
 render(<><Analytics/><AnalyticsConsentControls compact/></>);await screen.findByTestId('analytics-loader');
 fireEvent.click(screen.getByRole('button',{name:'Decline analytics'}));await waitFor(()=>expect(screen.queryByTestId('analytics-loader')).toBeNull());
 expect(screen.getByRole('status')).toHaveTextContent('Analytics is declined');expect(document.cookie).not.toContain('ecl_measurement');
});
