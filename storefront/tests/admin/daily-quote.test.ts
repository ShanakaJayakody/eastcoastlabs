import {expect,it} from 'vitest';
import {dailyQuote,nextQuoteDelay} from '@/lib/admin/daily-quote';
it('rotates at Melbourne midnight',()=>{
  const before=dailyQuote(new Date('2026-09-30T13:59:59Z')),after=dailyQuote(new Date('2026-09-30T14:00:00Z'));
  expect(before.day).toBe('2026-09-30');expect(after.day).toBe('2026-10-01');expect(before.id).not.toBe(after.id);
  expect(nextQuoteDelay(new Date('2026-09-30T13:59:59Z'))).toBe(1000);
});
it('is stable across UTC midnight and DST',()=>{
  expect(dailyQuote(new Date('2026-09-30T23:59:00Z'))).toEqual(dailyQuote(new Date('2026-10-01T00:01:00Z')));
  expect(dailyQuote(new Date('2026-10-03T15:30:00Z'))).toEqual(dailyQuote(new Date('2026-10-03T16:30:00Z')));
  expect(nextQuoteDelay(new Date('2026-10-03T14:00:00Z'))).toBe(23*60*60*1000);
});
it('rejects an invalid date',()=>expect(()=>dailyQuote(new Date('invalid'))).toThrow());
