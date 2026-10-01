import {createRoot} from 'react-dom/client';
import {useSyncExternalStore} from 'react';
import '../../app/globals.css';
import AdminShell from '@/components/admin/AdminShell';
import OrdersWorkspace from '@/components/admin/OrdersWorkspace';
import {parseOrderWorkspaceParams,rawOrderParams} from '@/lib/admin/order-workspace/params';
import {fixturePage,fixtureSnapshot,fixtureSubscribe,installFixturePreview} from './orders-workspace-adapter';
installFixturePreview();
function Fixture(){useSyncExternalStore(fixtureSubscribe,fixtureSnapshot);const params=parseOrderWorkspaceParams(rawOrderParams(new URLSearchParams(window.location.search))),data=fixturePage(params);return <AdminShell email="operator@example.test"><OrdersWorkspace params={params} data={data} adminUserId="synthetic-workspace-admin" reinstatable={Object.fromEntries(data.rows.filter(r=>r.status==='cancelled').map(r=>[r.id,{recoverable:true,short:0}]))}/></AdminShell>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
