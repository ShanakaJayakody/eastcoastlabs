import {expect,it} from 'vitest';
import {contribution,customerCohorts,matureCreatedToPaid,summarizeLines,type CustomerEconomicOrder,type VariableCosts} from '@/lib/admin/economics';
const costs:VariableCosts={carrier_cents:700,packaging_fulfilment_cents:200,payment_cents:100,replacement_cents:0,service_cents:50,acquisition_cents:500,tax_adjustment_cents:0,tax_basis_confirmed:true,note:'Actual costs',revision:1};
const line={order_id:'1',qty:1,refunded_qty:0,confirmed_returned_qty:0,unit_cost_cents:9500,line_total_cents:15000,discount_allocated_cents:1500,refunded_cents:0};
it('subtracts shipping/fees and acquisition once, and refuses missing expenses or unconfirmed tax basis',()=>{
 const profit=summarizeLines([line]);
 expect(contribution(14500,profit,costs)).toEqual({beforeAcquisitionCents:3950,afterAcquisitionCents:3450});
 expect(contribution(14500,profit,{...costs,acquisition_cents:null})).toEqual({beforeAcquisitionCents:3950,afterAcquisitionCents:null});
 expect(contribution(14500,profit,{...costs,carrier_cents:null}).beforeAcquisitionCents).toBeNull();
 expect(contribution(14500,profit,{...costs,tax_basis_confirmed:false}).beforeAcquisitionCents).toBeNull();
});
const order=(id:string,paid_at:string|null,extra:Partial<CustomerEconomicOrder>={}):CustomerEconomicOrder=>({id,customer_email:'ONE@example.test',created_at:'2026-01-01T00:00:00Z',paid_at,total_cents:1000,refunded_cents:0,contributionCents:200,...extra});
it('uses actual first payment and mature person-specific 60/90 day windows, including refunded purchases',()=>{
 const rows=customerCohorts([order('1','2026-02-01T00:00:00Z',{refunded_cents:1000,contributionCents:-200}),order('2','2026-04-12T00:00:00Z',{customer_email:'one@example.test'}),order('3','2026-05-20T00:00:00Z',{customer_email:'new@example.test'}),order('4',null)],new Date('2026-06-01T00:00:00Z'));
 expect(rows.find(r=>r.month==='2026-02')).toMatchObject({customers:1,repeatCustomers:1,day60:{eligible:1,repeat:0,revenueCents:0,contributionCents:-200},day90:{eligible:1,repeat:1,revenueCents:1000,contributionCents:0,coveredOrders:2,orders:2}});
 expect(rows.find(r=>r.month==='2026-05')?.day60.eligible).toBe(0);
});
it('only counts payment within the seven-day maturity horizon and excludes immature created orders',()=>{
 expect(matureCreatedToPaid([order('1','2026-01-08T00:00:00Z'),order('2','2026-01-09T00:00:00Z'),order('3',null,{created_at:'2026-01-09T00:00:00Z'})],new Date('2026-01-10T00:00:00Z'))).toEqual({days:7,eligible:2,paid:1,immature:1,pct:50});
});
it('keeps an entire mature cohort contribution unknown if one order is missing costs',()=>{
 const [cohort]=customerCohorts([order('1','2026-01-01T00:00:00Z'),order('2','2026-01-10T00:00:00Z',{contributionCents:null})],new Date('2026-06-01'));
 expect(cohort.day90).toMatchObject({contributionCents:null,coveredOrders:1,orders:2});
});

it('subtracts an explicit reconciled net tax adjustment and permits verified zero or signed credits',()=>{
 const gross=summarizeLines([{...line,unit_cost_cents:5500,line_total_cents:11000,discount_allocated_cents:0}]);
 const entered={...costs,carrier_cents:0,packaging_fulfilment_cents:0,payment_cents:0,replacement_cents:0,service_cents:0,acquisition_cents:200,tax_adjustment_cents:500};
 expect(contribution(11000,gross,entered)).toEqual({beforeAcquisitionCents:5000,afterAcquisitionCents:4800});
 expect(contribution(11000,gross,{...entered,tax_adjustment_cents:null})).toEqual({beforeAcquisitionCents:null,afterAcquisitionCents:null});
 expect(contribution(11000,gross,{...entered,tax_adjustment_cents:0}).beforeAcquisitionCents).toBe(5500);
 expect(contribution(11000,gross,{...entered,tax_adjustment_cents:-500}).beforeAcquisitionCents).toBe(6000);
});
