// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const m=vi.hoisted(()=>({operate:vi.fn(),refresh:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/automation/actions',()=>({operateEmail:m.operate}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
import EmailOperationControls from '@/components/admin/EmailOperationControls';
beforeEach(()=>{cleanup();vi.clearAllMocks();m.operate.mockResolvedValue({ok:false,error:'Provider reconciliation required'});});
it('requires an operator reason and shows guarded retry errors instead of claiming a send',async()=>{
 render(<EmailOperationControls id="row-1" status="failed" providerAttemptedAt="2026-09-08" leaseExpiresAt={null} providerId={null}/>);
 expect((screen.getByRole('button',{name:'Queue bounded retry'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Operator reason'),{target:{value:'Checked synthetic attempt'}});fireEvent.click(screen.getByRole('button',{name:'Queue bounded retry'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Provider reconciliation required'));
 expect(m.operate).toHaveBeenCalledWith('row-1','retry','Checked synthetic attempt','');
 expect(screen.queryByRole('button',{name:'Cancel unsent intent'})).toBeNull();
});
it('offers reconciliation for ambiguous sends and requires a provider ID',async()=>{
 render(<EmailOperationControls id="row-1" status="dead" providerAttemptedAt="2026-09-08" leaseExpiresAt={null} providerId={null}/>);
 fireEvent.change(screen.getByLabelText('Operator reason'),{target:{value:'Checked'}});expect((screen.getByRole('button',{name:'Reconcile provider acceptance'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Provider message ID'),{target:{value:'provider-1'}});fireEvent.click(screen.getByRole('button',{name:'Reconcile provider acceptance'}));
 await waitFor(()=>expect(m.operate).toHaveBeenCalledWith('row-1','reconcile','Checked','provider-1'));
});
it('active leases expose a waiting state without mutation controls',()=>{
 render(<EmailOperationControls id="row-1" status="sending" providerAttemptedAt={null} leaseExpiresAt={new Date(Date.now()+60000).toISOString()} providerId={null}/>);
 expect(screen.getByText(/Active delivery lease/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();
});
