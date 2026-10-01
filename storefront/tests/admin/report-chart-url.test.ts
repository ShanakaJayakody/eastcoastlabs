// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {revenueChartUrl} from '@/components/admin/RevenueChart';
import type {RevenueWindow} from '@/lib/admin/order-queries';
it('preserves the revenue report tab while changing the period',()=>{
 window.history.replaceState({},'','/admin/reports?tab=revenue&keep=1');
 const url=revenueChartUrl({isCurrent:false,scale:'week',anchor:'2026-09-21'} as RevenueWindow);
 expect(url).toContain('tab=revenue');expect(url).toContain('keep=1');expect(url).toContain('scale=week');
});
