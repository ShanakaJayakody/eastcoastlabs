import {expect,it} from 'vitest';
import {overviewWindow} from '@/lib/admin/overview/calendar';
const now=new Date('2026-09-29T02:00:00Z');
it('compares the same wall time today and yesterday',()=>{
 const w=overviewWindow({kind:'today'},now);
 expect([w.from,w.until,w.previousFrom,w.previousUntil]).toEqual(['2026-09-28T14:00:00.000Z','2026-09-29T02:00:00.000Z','2026-09-27T14:00:00.000Z','2026-09-28T02:00:00.000Z']);
});
it('uses seven completed days',()=>{const w=overviewWindow({kind:'week'},now);expect(w.bounds).toHaveLength(7);expect(w.until).toBe('2026-09-28T14:00:00.000Z');expect(w.from).toBe('2026-09-21T14:00:00.000Z');});
it('clamps shorter prior months with null intervals',()=>{const w=overviewWindow({kind:'month'},new Date('2024-03-31T01:00:00Z'));expect(w.previousUntil).toBe('2024-02-29T13:00:00.000Z');expect(w.previousBounds.filter(Boolean)).toHaveLength(29);expect(w.bounds).toHaveLength(31);expect(w.timing).toMatch(/shorter/);});
it('preserves the repeated hour on a DST fall-back day',()=>{const w=overviewWindow({kind:'today'},new Date('2026-04-05T12:00:00Z'));expect(w.bounds.filter(Boolean)).toHaveLength(23);expect(w.previousBounds.filter(Boolean)).toHaveLength(22);expect(w.labels.filter(v=>v.includes('02:00'))).toHaveLength(2);});
it.each([{kind:'nope'},{kind:'custom',from:'2026-02-30',to:'2026-03-01'},{kind:'custom',from:'2026-09-29',to:'2026-09-29'},{kind:'custom',from:'2020-01-01',to:'2026-01-01'},{kind:'custom',from:'2026-09-02',to:'2026-09-01'},null])('rejects invalid or unbounded input %j',range=>expect(()=>overviewWindow(range as never,now)).toThrow());
