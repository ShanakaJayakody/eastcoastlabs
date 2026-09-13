// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {ANALYTICS_CONSENT_COOKIE,MEASUREMENT_COOKIE,captureAcquisition,clearMeasurement,getOrderAttribution,setAnalyticsConsent} from '@/lib/attribution';

beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_CAMPAIGNS','spring,launch_2026');vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS','offer-holdout:control|holdout,test-0:control|holdout,test-1:control|holdout,test-2:control|holdout,test-3:control|holdout,test-4:control|holdout,test-5:control|holdout,test-6:control|holdout,test-7:control|holdout,test-8:control|holdout');for(const name of [ANALYTICS_CONSENT_COOKIE,MEASUREMENT_COOKIE])document.cookie=`${name}=; Max-Age=0; Path=/`;history.replaceState({},'','/');});

it('does not retain acquisition without granted analytics consent and clears it on denial',()=>{
 captureAcquisition('https://www.eastcoastlabs.com.au/shop?utm_source=google&utm_medium=cpc&utm_campaign=spring');
 expect(getOrderAttribution()).toBeNull();expect(document.cookie).not.toContain(MEASUREMENT_COOKIE);
 setAnalyticsConsent('granted');captureAcquisition('https://www.eastcoastlabs.com.au/shop?utm_source=google&utm_medium=cpc&utm_campaign=spring');
 expect(getOrderAttribution()).toEqual({acquisition:{source:'google',medium:'cpc',campaign:'spring',landingPath:'/shop'},experiments:[]});
 setAnalyticsConsent('denied');expect(getOrderAttribution()).toBeNull();expect(document.cookie).not.toContain(MEASUREMENT_COOKIE);
});

it('stores only allowlisted public landing and identifier fields, never referrer or PII-like values',()=>{
 setAnalyticsConsent('granted');
 captureAcquisition('https://www.eastcoastlabs.com.au/product/bpc-157?utm_source=google&utm_medium=paid-search&utm_campaign=launch_2026&utm_content=private@example.test&email=private@example.test#secret');
 expect(getOrderAttribution()).toEqual({acquisition:{source:'google',medium:'paid-search',campaign:'launch_2026',landingPath:'/product/bpc-157'},experiments:[]});
 expect(decodeURIComponent(document.cookie)).not.toMatch(/private@|secret|utm_content|email|referrer/i);
 clearMeasurement();captureAcquisition('https://www.eastcoastlabs.com.au/pay/order?utm_source=google');
 expect(getOrderAttribution()).toBeNull();
});
it.each(['0412345678','john-smith','private@example.test'])('rejects numeric, name-bearing or PII-like acquisition source %s',(source)=>{
 setAnalyticsConsent('granted');captureAcquisition(`https://www.eastcoastlabs.com.au/shop?utm_source=${encodeURIComponent(source)}&utm_medium=cpc`);expect(getOrderAttribution()).toBeNull();
});
it('keeps unconfigured campaigns and visits without source identifiers unattributed',()=>{
 setAnalyticsConsent('granted');captureAcquisition('https://www.eastcoastlabs.com.au/shop?utm_source=google&utm_medium=cpc&utm_campaign=unknown');expect(getOrderAttribution()).toBeNull();
 captureAcquisition('https://www.eastcoastlabs.com.au/shop');expect(getOrderAttribution()).toBeNull();
});

it('rejects malformed cookie JSON, unknown fields, oversized arrays and PII-like experiment values',()=>{
 setAnalyticsConsent('granted');
 for(const payload of ['%',JSON.stringify({acquisition:{source:'google',landingPath:'/shop',email:'private@example.test'},experiments:[]}),JSON.stringify({experiments:Array.from({length:9},(_,i)=>({experimentId:`test-${i}`,variant:'holdout'}))}),JSON.stringify({experiments:[{experimentId:'private@example.test',variant:'holdout'}]})]){
  document.cookie=`${MEASUREMENT_COOKIE}=${encodeURIComponent(payload)}; Path=/`;expect(getOrderAttribution()).toBeNull();
 }
});
