// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,cleanup,screen} from '@testing-library/react';
import {makeWorkspacePage,makeWorkspaceRow} from '../helpers/order-workspace-fixtures';
const m=vi.hoisted(()=>({guard:vi.fn(),read:vi.fn(),stock:vi.fn(),redirect:vi.fn((url:string)=>{throw Error(`REDIRECT ${url}`);})}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:m.guard}));vi.mock('@/lib/admin/order-workspace/queries',()=>({getOrderWorkspace:m.read}));vi.mock('@/lib/admin/orders',()=>({reinstatabilityFor:m.stock}));vi.mock('next/navigation',()=>({redirect:m.redirect}));
vi.mock('@/components/admin/OrdersWorkspace',()=>({default:(props:unknown)=><div data-testid="workspace">{JSON.stringify(props)}</div>}));
import OrdersPage from '@/app/admin/(dashboard)/orders/page';
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({userId:'authenticated-admin'});m.read.mockResolvedValue(makeWorkspacePage());m.stock.mockResolvedValue(new Map());});afterEach(cleanup);
it('guards before reads and passes normalized query plus server identity',async()=>{m.guard.mockRejectedValueOnce(Error('AUTH'));await expect(OrdersPage({searchParams:Promise.resolve({})})).rejects.toThrow('AUTH');expect(m.read).not.toHaveBeenCalled();render(await OrdersPage({searchParams:Promise.resolve({q:'needle',shipping:'express',discount:'VIP_20',order:makeWorkspaceRow().id})}));const props=JSON.parse(screen.getByTestId('workspace').textContent!);expect(props.params).toMatchObject({status:'all',q:'needle',shipping:'express',discount:'VIP_20',order:makeWorkspaceRow().id});expect(props.adminUserId).toBe('authenticated-admin');expect(m.stock).not.toHaveBeenCalled();});
it('only loads reinstatability for visible cancelled rows',async()=>{const row=makeWorkspaceRow({status:'cancelled'});m.read.mockResolvedValue(makeWorkspacePage([row]));await OrdersPage({searchParams:Promise.resolve({})});expect(m.stock).toHaveBeenCalledWith([row.id]);});
it('canonicalizes clamped pages and preserves filters',async()=>{m.read.mockResolvedValue({...makeWorkspacePage([]),page:1});await expect(OrdersPage({searchParams:Promise.resolve({page:'999',discount:'VIP',shipping:'express'})})).rejects.toThrow('REDIRECT /admin/orders?status=to_fulfil&discount=VIP&shipping=express');});
it('propagates read errors instead of successful empty states',async()=>{m.read.mockRejectedValueOnce(Error('offline'));await expect(OrdersPage({searchParams:Promise.resolve({status:'wrong'})})).rejects.toThrow('offline');expect(m.read).toHaveBeenCalledWith(expect.objectContaining({status:'to_fulfil'}));});
