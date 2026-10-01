// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,it,expect,vi} from 'vitest';
import {render,cleanup,screen,fireEvent} from '@testing-library/react';
import {makeWorkspacePage,makeWorkspaceParams} from '../helpers/order-workspace-fixtures';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn(),refresh:vi.fn()})}));vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({confirmPayment:vi.fn(),bulkConfirmPayment:vi.fn(),bulkReinstate:vi.fn()}));
import OrdersWorkspace from '@/components/admin/OrdersWorkspace';
import OrdersError from '@/app/admin/(dashboard)/orders/error';
afterEach(cleanup);
it.each([{q:'no-match',message:'No orders match these filters.'},{q:'',message:'Nothing to fulfil.'}])('distinguishes filtered-empty from empty work',({q,message})=>{render(<OrdersWorkspace params={makeWorkspaceParams({q})} data={makeWorkspacePage([])} adminUserId="synthetic"/>);expect(screen.getByText(message)).toBeVisible();expect(screen.queryByRole('heading',{level:1})).not.toBeInTheDocument();});
it('retries a failed read without changing the query',()=>{const reset=vi.fn();render(<OrdersError error={new Error('secret')} reset={reset}/>);expect(screen.queryByText('secret')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(reset).toHaveBeenCalledOnce();});
