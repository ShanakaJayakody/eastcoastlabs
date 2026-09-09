import {it,expect,vi} from 'vitest';
const {stocks}=vi.hoisted(()=>({stocks:new Map([['a',0],['b',0],['c',0]])}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'test@local.test'})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/admin/products',()=>({adjustStockWithNotify:async({variantId,qty}:{variantId:string;qty:number})=>{if(variantId==='b')throw Error('Fixture inventory conflict');stocks.set(variantId,stocks.get(variantId)!+qty);return {notified:0,warning:variantId==='c'?'Stock saved; do not repeat the adjustment.':undefined};}}));
import {bulkAdjustStock} from '@/app/admin/(dashboard)/products/actions';
it('a failed middle product reports its ID and still applies later selected products',async()=>{
 const result=await bulkAdjustStock(['a','b','c'],2,'adjustment');
 expect(stocks.get('a')).toBe(2);expect(stocks.get('b')).toBe(0);expect(stocks.get('c')).toBe(2);
 expect(result.warning).toContain('c: Stock saved');
 expect(result).toMatchObject({succeeded:['a','c'],failed:[{id:'b',error:'Fixture inventory conflict'}]});
});
