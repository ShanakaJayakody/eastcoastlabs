import { expect,it } from 'vitest';
import { duration, compareStats, completeComparison } from '@/lib/admin/fulfilment-analytics/format';
import { parseFulfilmentParams, fulfilmentHref } from '@/lib/admin/fulfilment-analytics/params';
import type { Period,Stats } from '@/lib/admin/fulfilment-analytics/types';
const stats=(median:number|null,n=12):Stats=>({n,median,mean:median,p90:median,max:median});
const period=(key:string,partial:string[],median:number|null):Period=>({key,partial,start_at:key,end_at:key,calendar_start:key,calendar_end:key,payment:stats(median),fulfilment:stats(median),total:stats(median),paid_count:12,shipped_count:12,distribution:[0,0,0,0]});

it('formats exact elapsed intervals without turning unknown or negative data into zero',()=>{
 expect(duration(129660)).toBe('1d 12h 1m');expect(duration(null)).toBe('—');expect(duration(-1)).toBe('—');expect(duration(0)).toBe('0s');expect(duration(45)).toBe('45s');
});
it('normalizes untrusted filters and preserves leap-day ranges',()=>{
 expect(parseFulfilmentParams({grain:'year',page:'-3',stat:'mode',view:'secret'})).toMatchObject({grain:'week',page:1,stat:'median',view:'waiting'});
 expect(parseFulfilmentParams({range:'custom',from:'2026-02-30',to:'2026-03-01'})).toMatchObject({range:'all',from:null,to:null});
 expect(parseFulfilmentParams({range:'custom',from:'2024-02-29',to:'2024-03-01'})).toMatchObject({range:'custom',from:'2024-02-29',to:'2024-03-01'});
 expect(parseFulfilmentParams({range:'custom',from:'2026-09-30',to:'2026-09-01'}).range).toBe('all');
});
it('retains scope when switching grouping and resets pagination for new filters',()=>{
 const p=parseFulfilmentParams({range:'custom',from:'2026-08-01',to:'2026-09-27',page:'3',tab:'trends'});
 const u=new URL(fulfilmentHref(p,{grain:'month'}),'https://example.test');
 expect(u.searchParams.get('from')).toBe('2026-08-01');expect(u.searchParams.get('to')).toBe('2026-09-27');expect(u.searchParams.get('page')).toBe('1');
});
it('compares adjacent complete periods without jumping across empty or partial buckets',()=>{
 const periods=[period('2026-08-03',[],50),period('2026-08-10',[],40),period('2026-08-17',[],null),period('2026-08-24',['in_progress'],5)];
 expect(completeComparison(periods,'fulfilment','median')).toBeNull();
 const c=completeComparison(periods.slice(0,2),'fulfilment','median');
 expect(c).toMatchObject({delta:-10,percent:-20,currentCount:12,previousCount:12});
});
it('handles zero baselines and small samples explicitly',()=>{
 expect(compareStats(stats(0,2),stats(86400,1),'median')).toMatchObject({delta:86400,percent:null,smallSample:true});
 expect(compareStats(stats(null,0),stats(1),'median')).toBeNull();
});
