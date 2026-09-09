import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),movement:vi.fn(),audit:vi.fn(),notify:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:m.read})})})})}));
vi.mock('@/lib/admin/inventory',()=>({recordMovement:m.movement}));
vi.mock('@/lib/admin/audit',()=>({logAudit:m.audit}));
vi.mock('@/lib/admin/notifications',()=>({queueBackInStock:m.notify}));
import {adjustStockWithNotify} from '@/lib/admin/products';
const input={variantId:'variant',qty:5,reason:'adjustment' as const,actor:'admin@example.test'};
beforeEach(()=>{
 vi.clearAllMocks();m.movement.mockResolvedValue(undefined);m.audit.mockResolvedValue(undefined);m.notify.mockResolvedValue(2);
 m.read.mockResolvedValueOnce({data:{on_hand:0,reserved:0},error:null}).mockResolvedValue({data:{on_hand:5,reserved:0},error:null});
});
it.each(['audit','read','notify'] as const)('reports a saved adjustment with a warning after %s follow-up fails',async boundary=>{
 if(boundary==='read')m.read.mockReset().mockResolvedValueOnce({data:{on_hand:0,reserved:0},error:null}).mockResolvedValue({data:null,error:{message:'offline'}});
 else m[boundary].mockRejectedValue(new Error('offline'));
 const result=await adjustStockWithNotify(input);
 expect(result.warning).toMatch(/saved.*do not repeat/is);
 expect(m.movement).toHaveBeenCalledTimes(1);
});
it('still rejects a failed stock movement before reporting saved',async()=>{
 m.movement.mockRejectedValue(new Error('stock conflict'));
 await expect(adjustStockWithNotify(input)).rejects.toThrow('stock conflict');
 expect(m.notify).not.toHaveBeenCalled();
});
