// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({view:vi.fn(),impression:vi.fn(),assignment:vi.fn()}));
vi.mock('@/lib/analytics',()=>({trackViewItem:m.view,trackExperimentImpression:m.impression,commerceItem:(input:{slug:string;name:string;size?:string;pack?:string;price?:number})=>({item_id:input.slug,item_name:input.name,item_variant:[input.size,input.pack].filter(Boolean).join(' · '),price:input.price})}));
vi.mock('@/lib/variant',()=>({HOMEPAGE_EXPERIMENT:{id:'homepage-2026q3',active:true,variants:[{id:'control',weight:1},{id:'v1',weight:1}]},recordExperimentAssignment:m.assignment}));
import ViewItemTracker from '@/components/ViewItemTracker';
import VariantTag from '@/components/VariantTag';
import {ANALYTICS_CONSENT_COOKIE,setAnalyticsConsent} from '@/lib/attribution';
beforeEach(()=>{document.cookie=`${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`;m.assignment.mockReturnValue(null);});
afterEach(()=>{cleanup();vi.clearAllMocks();document.cookie=`${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;});

it('tracks a product view with slug identity and selected size context',async()=>{
 render(<ViewItemTracker slug="bpc-157" name="BPC-157" price={59.99} size="5 mg"/>);
 await waitFor(()=>expect(m.view).toHaveBeenCalledWith({item_id:'bpc-157',item_name:'BPC-157',item_variant:'5 mg',price:59.99},59.99));
});
it('does not announce slash and slash-one route designs as an experiment while configuration is inactive',async()=>{
 render(<VariantTag variant="control"/>);await Promise.resolve();expect(m.impression).not.toHaveBeenCalled();
});
it('records the first product view after consent is granted on the mounted PDP',async()=>{
 document.cookie=`${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;
 render(<ViewItemTracker slug="bpc-157" name="BPC-157" price={59.99} size="5 mg"/>);
 expect(m.view).not.toHaveBeenCalled();
 setAnalyticsConsent('granted');
 await waitFor(()=>expect(m.view).toHaveBeenCalledTimes(1));
});
it('records and emits an active assignment after same-page consent without double firing',async()=>{
 document.cookie=`${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;
 m.assignment.mockImplementation(()=>document.cookie.includes(`${ANALYTICS_CONSENT_COOKIE}=granted`)?{experimentId:'homepage-2026q3',variant:'control'}:null);
 render(<VariantTag variant="control"/>);
 expect(m.impression).not.toHaveBeenCalled();
 setAnalyticsConsent('granted');
 await waitFor(()=>expect(m.impression).toHaveBeenCalledWith('homepage-2026q3','control'));
 setAnalyticsConsent('granted');
 expect(m.impression).toHaveBeenCalledTimes(1);
});
