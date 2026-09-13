// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/env',()=>({GA4_ID:'G-TEST'}));
vi.mock('@/lib/variant',()=>({getExperimentAssignments:()=>[]}));
import {commerceItem,trackViewItem,trackViewItemList,trackSelectItem,trackSelectSize,trackSelectPack,trackAddToCart,trackRemoveFromCart,trackPurchase,trackCreatorEvent,trackQuoteRequested,trackQuoteReady,trackQuoteError,trackPaymentStep} from '@/lib/analytics';
beforeEach(()=>{history.replaceState({},'', '/product/bpc-157');document.cookie='ecl_analytics_consent=granted; Path=/';window.gtag=undefined;sessionStorage.clear();});
it('buffers a view before readiness and flushes it once when provider is available',()=>{trackViewItem({item_id:'bpc',item_name:'BPC'});const sender=vi.fn();window.gtag=sender;trackAddToCart({item_id:'bpc',item_name:'BPC'});expect(sender.mock.calls.map(c=>c[1])).toEqual(['view_item','add_to_cart']);});
it.each(['/cart-recovery?token=secret','/pay/id?token=secret','/checkout/thank-you?order=secret','/leave-a-review?token=secret','/admin','/subscribe-confirm?token=secret','/unsubscribe?token=secret'])('never emits from private route %s',path=>{history.replaceState({},'',path);window.gtag=vi.fn();trackPurchase('order',[],50);expect(window.gtag).not.toHaveBeenCalled();});
it('overrides automatic location and referrer with sanitized public paths',()=>{history.replaceState({},'', '/shop?email=private@example.test&token=secret');const sender=vi.fn();window.gtag=sender;trackViewItem({item_id:'bpc',item_name:'BPC'});const args=sender.mock.calls[0][2];expect(args).toMatchObject({page_location:'http://localhost:3000/shop',page_referrer:''});expect(JSON.stringify(args)).not.toContain('secret');});
it('drops pending public analytics when navigation enters a private page',()=>{trackViewItem({item_id:'queued',item_name:'Queued'});history.replaceState({},'', '/pay/id?token=private-token');const sender=vi.fn();window.gtag=sender;trackAddToCart({item_id:'private',item_name:'Private'});expect(sender).not.toHaveBeenCalled();history.replaceState({},'', '/shop');trackAddToCart({item_id:'new',item_name:'New'});expect(sender.mock.calls.map(c=>c[1])).toEqual(['add_to_cart']);expect(JSON.stringify(sender.mock.calls)).not.toContain('private-token');});
it('measures the creator landing page but not the creator privacy notice',()=>{history.replaceState({},'', '/creators?email=private@example.test#apply');const sender=vi.fn();window.gtag=sender;trackCreatorEvent('creator_cta_click',{placement:'hero'});expect(sender).toHaveBeenCalledWith('event','creator_cta_click',expect.objectContaining({placement:'hero',page_location:'http://localhost:3000/creators'}));expect(JSON.stringify(sender.mock.calls)).not.toContain('private@example.test');history.replaceState({},'', '/creators/privacy');trackCreatorEvent('creator_cta_click',{placement:'footer'});expect(sender).toHaveBeenCalledTimes(1);});
it('drops creator conversion events that resolve after navigation away from creators',()=>{history.replaceState({},'', '/creators');const sender=vi.fn();window.gtag=sender;trackCreatorEvent('creator_application_start');history.replaceState({},'', '/shop');trackCreatorEvent('creator_application_submit');expect(sender.mock.calls.map(c=>c[1])).toEqual(['creator_application_start']);});
it('only emits allowed creator event properties',()=>{history.replaceState({},'', '/creators');const sender=vi.fn();window.gtag=sender;trackCreatorEvent('creator_application_error',{placement:'sticky',errorCode:'validation',email:'private@example.test',pitch:'private pitch',socialUrl:'https://instagram.com/private'} as never);const payload=sender.mock.calls[0][2];expect(payload).toMatchObject({placement:'sticky',error_code:'validation'});expect(JSON.stringify(payload)).not.toMatch(/private|pitch|instagram/);});
it('uses the catalogue slug as one browser identity and keeps size and pack in item_variant',()=>{
 const item=commerceItem({slug:'bpc-157',name:'BPC-157',size:'5 mg',pack:'3 vials',price:79.99,quantity:2});
 expect(item).toEqual({item_id:'bpc-157',item_name:'BPC-157',item_variant:'5 mg · 3 vials',price:79.99,quantity:2});
 const sender=vi.fn();window.gtag=sender;trackViewItem(item);trackAddToCart(item);
 expect(sender.mock.calls.map(call=>[call[1],call[2]])).toEqual([
  ['view_item',{currency:'AUD',value:79.99,items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['add_to_cart',{currency:'AUD',value:159.98,items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
 ]);
});
it('normalizes an internal physical size slug back to its parent catalogue identity',()=>{
 expect(commerceItem({slug:'bpc-157-size-1234567890abcdef1234567890abcdef',name:'BPC-157',size:'5 mg'})).toEqual({item_id:'bpc-157',item_name:'BPC-157',item_variant:'5 mg'});
});
it('never throws or leaks hostile metadata while safely bounding a long legitimate catalogue name',()=>{
 const longName='Long research catalogue name '.repeat(8);
 expect(()=>commerceItem({slug:'valid-item',name:longName,price:Number.NaN,quantity:1000,size:'private@example.test'})).not.toThrow();
 const item=commerceItem({slug:'private@example.test',name:'private@example.test',price:Number.NaN,quantity:1000,size:'private@example.test'});
 expect(item).toEqual({item_id:'unknown',item_name:'Product'});expect(JSON.stringify(item)).not.toContain('private@example.test');
 expect(commerceItem({slug:'valid-item',name:longName}).item_name).toBe(longName.trim().slice(0,100));
});
it('emits bounded listing, selection, removal, quote and payment funnel payloads',()=>{
 const item=commerceItem({slug:'bpc-157',name:'BPC-157',size:'5 mg',pack:'1 vial',price:59.99,quantity:1});
 const sender=vi.fn();window.gtag=sender;
 trackViewItemList([item],'shop','Shop');trackSelectItem(item,'shop','Shop');trackSelectSize(item);trackSelectPack(item);trackRemoveFromCart(item);
 const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';trackQuoteRequested(request);trackQuoteReady(request,1240);trackQuoteError(request,15000,'timeout');
 trackPaymentStep('method_selected','bank_transfer');trackPaymentStep('order_submitted','bank_transfer');
 expect(sender.mock.calls.map(call=>[call[1],call[2]])).toEqual([
  ['view_item_list',{item_list_id:'shop',item_list_name:'Shop',items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['select_item',{item_list_id:'shop',item_list_name:'Shop',items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['select_size',{items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['select_pack',{items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['remove_from_cart',{currency:'AUD',value:59.99,items:[item],page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['quote_requested',{quote_request_id:request,page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['quote_ready',{quote_request_id:request,quote_duration_ms:1240,page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['quote_error',{quote_request_id:request,quote_duration_ms:15000,error_code:'timeout',page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['payment_step',{payment_step:'method_selected',payment_method:'bank_transfer',page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
  ['payment_step',{payment_step:'order_submitted',payment_method:'bank_transfer',page_location:'http://localhost:3000/product/bpc-157',page_referrer:''}],
 ]);
});
it('drops malformed bounded helper values and all events when analytics consent is denied',()=>{
 const sender=vi.fn();window.gtag=sender;
 trackQuoteRequested('private@example.test');trackQuoteReady('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',-1);
 trackQuoteError('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',20,'customer@example.test' as never);trackPaymentStep('email_entered' as never,'card' as never);
 expect(sender).not.toHaveBeenCalled();
 document.cookie='ecl_analytics_consent=denied; Path=/';
 trackViewItem(commerceItem({slug:'bpc-157',name:'BPC-157'}));
 expect(sender).not.toHaveBeenCalled();
});
