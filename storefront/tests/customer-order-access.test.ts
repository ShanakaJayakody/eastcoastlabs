import { expect, it } from 'vitest';
import { createOrderViewToken, verifyOrderViewToken, orderViewPath, createOrderCookie, verifyOrderCookie } from '@/lib/customer-orders/tokens';
import { createOrderAccessToken } from '@/lib/order-access';
const id='10000000-0000-0000-0000-000000000011';
const other='10000000-0000-0000-0000-000000000012';
const opts={secret:'a'.repeat(32),nowMs:Date.parse('2026-09-30T00:00:00Z')};
it('binds a read capability to its order, version, lifetime and separate purpose',()=>{
 const t=createOrderViewToken(id,3,opts);
 expect(verifyOrderViewToken(t,opts)).toMatchObject({orderId:id,version:3});
 expect(verifyOrderViewToken(t.replace(id,other),opts)).toBeNull();
 expect(verifyOrderViewToken(t,{...opts,nowMs:opts.nowMs+30*86400_000})).toBeNull();
 expect(verifyOrderViewToken(createOrderAccessToken(id,'payment',opts),opts)).toBeNull();
 expect(orderViewPath(id,3,opts)).toContain('/orders/access?token=');
});
it('exchanges into a shorter-lived cookie that cannot be used as an email capability',()=>{
 const grant=verifyOrderViewToken(createOrderViewToken(id,2,opts),opts)!;
 const cookie=createOrderCookie(grant,opts);
 expect(verifyOrderCookie(cookie,opts)).toMatchObject({orderId:id,version:2});
 expect(verifyOrderCookie(cookie,{...opts,nowMs:opts.nowMs+86400_000})).toBeNull();
 expect(verifyOrderViewToken(cookie,opts)).toBeNull();
});
it.each(['','x'.repeat(1000),'v1.bad.NaN.0.x'])('rejects malformed capabilities without throwing',token=>{
 expect(verifyOrderViewToken(token,opts)).toBeNull();
});
