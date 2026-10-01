'use client';
import {useEffect,useRef,type KeyboardEvent} from 'react';
import {formatAud} from '@/lib/format';
import {orderItemVariantIdentity} from '@/lib/admin/order-item-identity';
import {orderWorkspaceHref} from '@/lib/admin/order-workspace/params';
import {COLUMN_LABELS,ISSUE_LABELS,paymentLabel,fulfilmentLabel,waitingLabel,physicalQuantityLabel,orderDate} from '@/lib/admin/order-workspace/presentation';
import type {OrderWorkspaceRow,OrderWorkspaceParams,OrderColumn,WorkspaceSort} from '@/lib/admin/order-workspace/types';
import {OrderState} from './OrderStatusPair';
export interface OrderListProps {rows:OrderWorkspaceRow[];params:OrderWorkspaceParams;selectedIds:ReadonlySet<string>;columns:OrderColumn[];density:'comfortable'|'compact';onToggle:(id:string)=>void;onTogglePage:()=>void;onOpen:(id:string,trigger:HTMLElement)=>void;onSort:(sort:WorkspaceSort,dir:'asc'|'desc')=>void;dialogOpen:boolean;}
export function OrderIssues({row}:{row:OrderWorkspaceRow}){return <>{row.issue_keys.map(k=><p className="ow-issue" key={k}>{ISSUE_LABELS[k]}</p>)}</>;}
export function OrderIdentity({row,params,onOpen}:{row:OrderWorkspaceRow;params:OrderWorkspaceParams;onOpen:OrderListProps['onOpen']}){
 const href=`/admin/orders/${row.id}?${new URLSearchParams({returnTo:orderWorkspaceHref(params,{order:null})})}`;
 return <div className="ow-wrap"><a className="ow-order-link" href={href} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onOpen(row.id,e.currentTarget);}}>{row.order_number}</a><p>{row.customer_name||row.customer_email}</p>{row.customer_name&&<p className="ow-secondary">{row.customer_email}</p>}<OrderIssues row={row}/>{row.has_notes&&<span className="ow-secondary">Order note</span>}</div>;
}
export function OrderItems({row,onOpen,summary=true}:{row:OrderWorkspaceRow;onOpen:OrderListProps['onOpen'];summary?:boolean}){return <div className="ow-wrap">
 {row.items.map(i=>{const identity=orderItemVariantIdentity(i.variant_label,i.size_label);return <div className="ow-item" key={i.id}><span>{i.qty} × {i.product_name||'Historical item'}</span><div>{identity.sizeLabel&&<strong className="ow-size">{identity.sizeLabel}</strong>}<span className="ow-secondary">{identity.detailLabel}{i.refunded_qty?` · ${i.refunded_qty} refunded`:''}</span></div></div>;})}
 {summary&&<p className="ow-secondary">{row.line_count} line {row.line_count===1?'item':'items'} · {physicalQuantityLabel(row)}</p>}
 {row.line_count>row.items.length&&<button className="ow-text-button" onClick={e=>onOpen(row.id,e.currentTarget)}>+{row.line_count-row.items.length} more items</button>}
 </div>;}
export function OrderShipping({row}:{row:OrderWorkspaceRow}){return <div><span className={`ow-badge ${row.shipping_method==='express'?'ow-express':''}`}>{row.shipping_method==='express'?'Express':'Standard'}</span>{row.destination&&<p className="ow-secondary ow-wrap">{row.destination}</p>}</div>;}
const COLUMN_SORT:Partial<Record<OrderColumn,WorkspaceSort>>={identity:'order_number',waiting:'waiting_seconds',placed:'created_at',total:'total_cents'};
export function PageCheckbox({rows,selectedIds,onTogglePage}:{rows:OrderWorkspaceRow[];selectedIds:ReadonlySet<string>;onTogglePage:()=>void}){
 const ref=useRef<HTMLInputElement>(null),count=rows.filter(r=>selectedIds.has(r.id)).length;
 useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&count<rows.length;},[count,rows.length]);
 return <input ref={ref} type="checkbox" aria-label="Select all orders on this page" checked={rows.length>0&&count===rows.length} onChange={onTogglePage}/>;
}
export default function OrderWorkspaceTable(p:OrderListProps){
 const ref=useRef<HTMLTableSectionElement>(null);
 function key(e:KeyboardEvent<HTMLTableRowElement>,i:number){
  if(p.dialogOpen||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||(e.target as HTMLElement).closest('input,button,a,select,textarea,[contenteditable=true]'))return;
  if(e.key==='j'||e.key==='k'){e.preventDefault();(ref.current?.children[Math.max(0,Math.min(p.rows.length-1,i+(e.key==='j'?1:-1)))] as HTMLElement)?.focus();}
  if(e.key==='x'){e.preventDefault();p.onToggle(p.rows[i].id);}
  if(e.key==='Enter'){e.preventDefault();p.onOpen(p.rows[i].id,e.currentTarget);}
  if(e.key==='Escape')e.currentTarget.blur();
 }
 return <table className={`ow-table ow-${p.density}`} aria-label="Orders"><caption className="sr-only">Order results. Dates shown in Sydney time.</caption><thead><tr><th className="ow-select-cell"><PageCheckbox {...p}/></th>{p.columns.map(c=>{const sort=COLUMN_SORT[c];return <th key={c} className={`ow-col-${c}`} aria-sort={sort===p.params.sort?(p.params.dir==='asc'?'ascending':'descending'):undefined}>{sort?<button aria-label={`Sort by ${COLUMN_LABELS[c]}`} onClick={()=>p.onSort(sort,p.params.sort===sort&&p.params.dir==='desc'?'asc':'desc')}>{COLUMN_LABELS[c]} {p.params.sort===sort?(p.params.dir==='asc'?'↑':'↓'):''}</button>:COLUMN_LABELS[c]}</th>;})}</tr></thead>
 <tbody ref={ref}>{p.rows.map((row,i)=><tr key={row.id} tabIndex={0} aria-label={`Order ${row.order_number}`} data-selected={p.selectedIds.has(row.id)} onKeyDown={e=>key(e,i)} onClick={e=>{if(!(e.target as HTMLElement).closest('input,button,a,label'))p.onOpen(row.id,e.currentTarget);}}><td className="ow-select-cell"><input type="checkbox" aria-label={`Select ${row.order_number}`} checked={p.selectedIds.has(row.id)} onChange={()=>p.onToggle(row.id)}/></td>{p.columns.map(c=><td key={c} className={`ow-col-${c}`}>
 {c==='identity'?<OrderIdentity row={row} {...p}/>:c==='items'?<OrderItems row={row} onOpen={p.onOpen}/>:c==='shipping'?<OrderShipping row={row}/>:c==='payment'?<OrderState value={paymentLabel(row)}/>:c==='fulfilment'?<OrderState value={fulfilmentLabel(row)}/>:c==='waiting'?waitingLabel(row):c==='placed'?<time dateTime={row.created_at??undefined}>{orderDate(row.created_at)}</time>:formatAud(row.total_cents/100)}
 </td>)}</tr>)}</tbody></table>;
}
