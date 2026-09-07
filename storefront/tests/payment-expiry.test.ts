import { expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({cancel:vi.fn(async()=>{}),expire:vi.fn(async()=>false),queue:vi.fn(async()=>{})}));
vi.mock("@/lib/admin/orders",()=>({cancelOrder:m.cancel,expireOrder:m.expire}));
vi.mock("@/lib/admin/email",()=>({queueEmail:m.queue}));
vi.mock("@/lib/admin/db",()=>({adminDb:()=>({from:()=>({select:()=>({eq:()=>({not:()=>({lt:()=>({limit:async()=>({data:[{id:"order-1",order_number:"ECL-1"}],error:null})})})})})})})}));
import { expireUnpaidOrders } from "@/lib/admin/payment-ops";
it('does not cancel an order that was paid after the expiry candidate read',async()=>{
 expect(await expireUnpaidOrders()).toEqual({expired:0,failed:0});
 expect(m.expire).toHaveBeenCalledWith('order-1');expect(m.cancel).not.toHaveBeenCalled();expect(m.queue).not.toHaveBeenCalled();
});
