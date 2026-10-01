'use client';
import {formatAud} from '@/lib/format';
import {waitingLabel,physicalQuantityLabel} from '@/lib/admin/order-workspace/presentation';
import OrderStatusPair from './OrderStatusPair';
import {OrderItems,OrderIdentity,OrderShipping,PageCheckbox,type OrderListProps} from './OrderWorkspaceTable';
export default function OrderCards(p:OrderListProps){return <div className="ow-cards"><label className="ow-card-select"><PageCheckbox {...p}/>Select this page</label>{p.rows.map(row=><article key={row.id} className="ow-card" data-selected={p.selectedIds.has(row.id)} aria-label={`Order ${row.order_number}`}>
 <div className="ow-card-top"><OrderIdentity row={row} {...p}/><label className="ow-touch-checkbox"><input type="checkbox" aria-label={`Select ${row.order_number}`} checked={p.selectedIds.has(row.id)} onChange={()=>p.onToggle(row.id)}/></label></div>
 <div className="ow-card-facts"><OrderShipping row={row}/><span>{waitingLabel(row)}</span></div><OrderStatusPair row={row}/>
 <OrderItems row={row} onOpen={p.onOpen} summary={false}/><p>{physicalQuantityLabel(row)} <span className="ow-secondary">· {row.line_count} line {row.line_count===1?'item':'items'}</span></p>
 <div className="ow-card-footer"><strong>{formatAud(row.total_cents/100)}</strong><button onClick={e=>p.onOpen(row.id,e.currentTarget)}>Open order {row.order_number}</button></div>
 </article>)}</div>;}
