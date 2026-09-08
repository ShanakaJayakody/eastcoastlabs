import {beforeEach,it,expect,vi} from 'vitest';
const {requireAdmin,registerStockLot,allocateOrderLots,previewCarrierCsv,commitCarrierRows,revalidatePath}=vi.hoisted(()=>({requireAdmin:vi.fn(),registerStockLot:vi.fn(),allocateOrderLots:vi.fn(),previewCarrierCsv:vi.fn(),commitCarrierRows:vi.fn(),revalidatePath:vi.fn()}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin}));vi.mock('next/cache',()=>({revalidatePath}));vi.mock('@/lib/admin/fulfilment',()=>({registerStockLot,allocateOrderLots,previewCarrierCsv,commitCarrierRows}));
import {registerLot,saveLotAssignments,previewCarrier,commitCarrier} from '@/app/admin/(dashboard)/orders/fulfilment-actions';
beforeEach(()=>{vi.resetAllMocks();requireAdmin.mockResolvedValue({email:'operator@example.test'})});
it('gates all fulfilment operations before reading or writing',async()=>{
 requireAdmin.mockRejectedValue(new Error('Denied'));
 await expect(registerLot({poolId:'pool',code:'lot',units:1,receiptId:null,coaId:null,evidence:'Counted'})).rejects.toThrow('Denied');
 await expect(saveLotAssignments('order','item','pool',[],'Returned')).rejects.toThrow('Denied');await expect(previewCarrier('csv')).rejects.toThrow('Denied');await expect(commitCarrier(['token'],false)).rejects.toThrow('Denied');
 for(const fn of [registerStockLot,allocateOrderLots,previewCarrierCsv,commitCarrierRows])expect(fn).not.toHaveBeenCalled();
});
it('uses the authenticated actor, preserves per-row outcomes and surfaces failures',async()=>{
 const input={poolId:'pool',code:'lot',units:1,receiptId:'receipt',coaId:'coa',evidence:'Counted'};registerStockLot.mockResolvedValue('lot');expect(await registerLot(input)).toEqual({ok:true});expect(registerStockLot).toHaveBeenCalledWith(input,'operator@example.test');
 allocateOrderLots.mockResolvedValue({});await saveLotAssignments('order','item','pool',[],'Returned');expect(allocateOrderLots).toHaveBeenCalledWith('order','item','pool',[],'Returned','operator@example.test');
 const rows=[{token:'token',ok:false,error:'CARRIER_PREVIEW_STALE'}];commitCarrierRows.mockResolvedValue(rows);expect(await commitCarrier(['token'],false)).toEqual({ok:true,rows});expect(commitCarrierRows).toHaveBeenCalledWith(['token'],false,'operator@example.test');
 previewCarrierCsv.mockRejectedValue(new Error('Duplicate order'));expect(await previewCarrier('bad')).toEqual({ok:false,error:'Duplicate order'});
});
