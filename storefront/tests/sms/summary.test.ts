import { beforeEach,expect,it,vi } from 'vitest';
const fake=vi.hoisted(()=>({rpc:vi.fn(),products:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:fake.rpc,from:()=>({select:()=>({order:fake.products})})})}));
import { buildAdminSmsSummary } from '@/lib/admin/daily-sms';
function products(){return ['bacteriostatic-water','alcohol-swabs','semaglutide','tesamorelin','ss-31','igf'].map(slug=>({
  id:slug,slug,name:slug,status:'active',sku:slug,images:[],product_variants:[{id:slug,sku:slug,pack_size:1,label:'Single',active:true,price_cents:1000,compare_at_cents:null,inventory:{on_hand:10,reserved:0,low_stock_threshold:5}}],
}))}
beforeEach(()=>{
  fake.rpc.mockResolvedValue({data:{yesterdayRevenueCents:123401,monthRevenueCents:432100,overdueFulfilment:60},error:null});
  fake.products.mockResolvedValue({data:products(),error:null});
});
it('refuses missing raw inventory instead of manufacturing a low-stock alert',async()=>{
  const data=products();data[0].product_variants[0].inventory=null as never;
  fake.products.mockResolvedValue({data,error:null});
  await expect(buildAdminSmsSummary(new Date('2026-09-29T22:00:00Z'))).rejects.toThrow(/inventory|stock/i);
});
it('refuses missing thresholds and retains current pool-based admin availability when data exists',async()=>{
  expect(await buildAdminSmsSummary(new Date('2026-09-29T22:00:00Z'))).toMatchObject({lowStockNames:[],overdueFulfilment:60});
  const data=products();data[1].product_variants[0].inventory.low_stock_threshold=null as never;
  fake.products.mockResolvedValue({data,error:null});
  await expect(buildAdminSmsSummary(new Date('2026-09-29T22:00:00Z'))).rejects.toThrow(/threshold|stock/i);
});
