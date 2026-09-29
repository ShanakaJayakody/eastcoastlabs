import { expect, it } from 'vitest';
import { normalizeAustralianMobile, renderAdminSms, smsSegments, selectLowStockNames, smsSchedule } from '@/lib/sms/format';

it('preserves all five required fields, AUD cents and independently measured segment count',()=>{
  const text=renderAdminSms({reportDate:'2026-09-29',asOf:'2026-09-29T22:00:00Z',month:'2026-09',
    yesterdayRevenueCents:124001,monthRevenueCents:1523456,overdueFulfilment:3,
    lowStockNames:['Alc Swabs','Sema','Tesa','SS31','IGF']});
  expect(text).toBe("Daily ECL Director Update:\nYesterday's Revenue: $1,240.01\nOverdue Orders to fulfil: 3\nMonthly Revenue: $15,234.56\nLow Stock: Alc Swabs, Sema, Tesa, SS31, IGF");
  expect(smsSegments(text)).toBe(1);
  expect(smsSegments(text.replace('Low Stock: ','Low Stock: Bac Water, '))).toBe(2);
});
it('rejects unknown totals instead of reporting zero and never silently truncates the stock list',()=>{
  const summary={reportDate:'2026-09-29',asOf:'2026-09-29T22:00:00Z',month:'2026-09',yesterdayRevenueCents:0,monthRevenueCents:0,overdueFulfilment:0,lowStockNames:[] as string[]};
  expect(renderAdminSms(summary)).toContain('Low Stock: None');
  expect(()=>renderAdminSms({...summary,yesterdayRevenueCents:NaN})).toThrow();
  expect(()=>renderAdminSms({...summary,overdueFulfilment:-1})).toThrow();
  expect(()=>renderAdminSms({...summary,lowStockNames:['x'.repeat(250)]})).toThrow();
});
it('counts GSM extension characters and rejects unsupported Unicode or an over-limit body',()=>{
  expect(smsSegments('a'.repeat(160))).toBe(1);
  expect(smsSegments('a'.repeat(161))).toBe(2);
  expect(smsSegments('a'.repeat(306))).toBe(2);
  expect(smsSegments('a'.repeat(158)+'^')).toBe(1);
  expect(smsSegments('a'.repeat(159)+'^')).toBe(2);
  expect(()=>smsSegments('a'.repeat(307))).toThrow();
  expect(()=>smsSegments('💰')).toThrow();
});
it('normalizes Australian mobiles and rejects invalid or foreign numbers',()=>{
  expect(normalizeAustralianMobile('0400 000 001')).toBe('61400000001');
  expect(normalizeAustralianMobile('+61 400 000 001')).toBe('61400000001');
  expect(normalizeAustralianMobile('+1 212 555 0100')).toBeNull();
  expect(normalizeAustralianMobile('6140000000x')).toBeNull();
});
it('uses live thresholds, deduplicates packs and never confuses Semax with Semaglutide',()=>{
  const products=['bacteriostatic-water','alcohol-swabs','semaglutide','tesamorelin','ss-31','igf','semax'].map(slug=>({slug,variants:[{available:20,low_stock_threshold:5}]}));
  products[1].variants=[{available:5,low_stock_threshold:5},{available:0,low_stock_threshold:5}];
  products[6].variants=[{available:0,low_stock_threshold:5}];
  expect(selectLowStockNames(products)).toEqual(['Alc Swabs']);
  products[2].variants[0].available=0;
  expect(selectLowStockNames(products)).toEqual(['Alc Swabs','Sema']);
  expect(()=>selectLowStockNames(products.slice(1))).toThrow(/Bac Water/);
});
it('gates by Melbourne calendar date and hour across daylight-saving changes, including weekends',()=>{
  expect(smsSchedule(new Date('2026-10-02T22:10:00Z'),8)).toMatchObject({day:'2026-10-03',eligible:true,expiresAt:'2026-10-03T02:00:00.000Z'});
  expect(smsSchedule(new Date('2026-10-03T21:10:00Z'),8)).toMatchObject({day:'2026-10-04',eligible:true,expiresAt:'2026-10-04T01:00:00.000Z'});
  expect(smsSchedule(new Date('2026-10-03T20:59:00Z'),8).eligible).toBe(false);
  expect(smsSchedule(new Date('2026-10-04T01:00:00Z'),8).eligible).toBe(false);
  expect(smsSchedule(new Date('2026-09-30T07:10:00Z'),17).eligible).toBe(true);
});
