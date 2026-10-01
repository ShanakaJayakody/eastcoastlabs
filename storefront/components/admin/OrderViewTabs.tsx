'use client';
import {ORDER_VIEWS} from '@/lib/admin/order-workspace/params';
import {VIEW_LABELS} from '@/lib/admin/order-workspace/presentation';
import type {OrderView,OrderWorkspacePage} from '@/lib/admin/order-workspace/types';
export default function OrderViewTabs({view,counts,onChange}:{view:OrderView;counts:OrderWorkspacePage['counts'];onChange:(v:OrderView)=>void}){
 return <nav aria-label="Order views" className="ow-views">
  {ORDER_VIEWS.slice(0,5).map(v=><button key={v} type="button" aria-current={view===v?'page':undefined} onClick={()=>onChange(v)}>{VIEW_LABELS[v]} <span className="ow-count">{counts[v]}</span></button>)}
  <label className="sr-only" htmlFor="order-more-views">More views</label><select id="order-more-views" value={ORDER_VIEWS.slice(5).includes(view)?view:''} onChange={e=>onChange(e.target.value as OrderView)}><option value="" disabled>More views</option>{ORDER_VIEWS.slice(5).map(v=><option key={v} value={v}>{VIEW_LABELS[v]} ({counts[v]})</option>)}</select>
 </nav>;
}
