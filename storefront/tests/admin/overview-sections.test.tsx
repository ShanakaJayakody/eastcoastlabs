// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {aggregatePaidRevenue} from '@/lib/admin/overview/revenue';
import ProgressHighlight from '@/components/admin/overview/ProgressHighlight';
import OverviewSection from '@/components/admin/overview/OverviewSection';
const {refresh}=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('highlights only a completed paid day, without a sample goal',()=>{
 const month=aggregatePaidRevenue([{id:'1',paid_at:'2026-09-28T00:00:00Z',total_cents:15000},{id:'2',paid_at:'2026-09-29T00:00:00Z',total_cents:40000}],{kind:'month'},new Date('2026-09-29T02:00:00Z'));
 render(<ProgressHighlight month={month}/>);
 expect(screen.getByText('$150.00')).toBeTruthy();expect(screen.getByText('$550.00')).toBeTruthy();
 expect(screen.queryByRole('progressbar')).toBeNull();expect(screen.queryByText(/20,000/)).toBeNull();
});
it('isolates a failed section and offers retry',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 function Broken():React.ReactNode{throw Error('test read failure');}
 render(<><OverviewSection title="Revenue"><Broken/></OverviewSection><p>Open work is still here</p></>);
 expect(screen.getByRole('alert')).toBeTruthy();expect(screen.getByText('Open work is still here')).toBeTruthy();
 fireEvent.click(screen.getByText('Retry'));expect(refresh).toHaveBeenCalled();
});
