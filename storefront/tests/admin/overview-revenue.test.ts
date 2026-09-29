import {expect,it} from 'vitest';
import {aggregatePaidRevenue} from '@/lib/admin/overview/revenue';
const now=new Date('2026-09-29T02:00:00Z'),range={kind:'today'} as const;
const fact={id:'one',paid_at:'2026-09-29T00:00:00Z',total_cents:12550};
it('returns zero totals but no fabricated baseline or average',()=>{const d=aggregatePaidRevenue([],range,now);expect(d.totalCents).toBe(0);expect(d.changePercent).toBeNull();expect(d.averageCents).toBeNull();});
it('counts paid gross facts once and uses half-open payment windows',()=>{
 const d=aggregatePaidRevenue([fact,fact,{...fact,id:'end',paid_at:now.toISOString()},{...fact,id:'prior',paid_at:'2026-09-28T00:00:00Z',total_cents:5000}],range,now);
 expect(d.totalCents).toBe(12550);expect(d.paidOrderCount).toBe(1);expect(d.averageCents).toBe(12550);expect(d.previousTotalCents).toBe(5000);
 expect(d.points.reduce((a,p)=>a+(p.cents??0),0)).toBe(d.totalCents);
 expect(d.points.reduce((a,p)=>a+(p.previousCents??0),0)).toBe(d.previousTotalCents);
});
it.each([NaN,-1,0.5,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects invalid cents %s',total_cents=>expect(()=>aggregatePaidRevenue([{...fact,total_cents}],range,now)).toThrow());
it('rejects invalid timestamps and conflicting duplicates',()=>{
 expect(()=>aggregatePaidRevenue([{...fact,paid_at:'invalid'}],range,now)).toThrow();
 expect(()=>aggregatePaidRevenue([fact,{...fact,total_cents:2}],range,now)).toThrow();
});
it('preserves both repeated DST hours and the null comparison gap',()=>{
 const d=aggregatePaidRevenue([{...fact,paid_at:'2026-04-04T15:30:00Z'},{...fact,id:'second',paid_at:'2026-04-04T16:30:00Z'}],range,new Date('2026-04-05T12:00:00Z'));
 expect(d.totalCents).toBe(25100);expect(d.points.reduce((a,p)=>a+(p.cents??0),0)).toBe(25100);expect(d.points.at(-1)?.previousCents).toBeNull();
});
