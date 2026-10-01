import {paymentLabel,fulfilmentLabel} from '@/lib/admin/order-workspace/presentation';
import type {OrderLabel,OrderWorkspaceRow} from '@/lib/admin/order-workspace/types';
export function OrderState({value}:{value:OrderLabel}){return <div><span className={`ow-badge ow-tone-${value.tone}`}>{value.label}</span>{value.detail&&<p className="ow-secondary ow-wrap">{value.detail}</p>}</div>;}
export default function OrderStatusPair({row}:{row:OrderWorkspaceRow}){return <div className="ow-status-pair"><OrderState value={paymentLabel(row)}/><OrderState value={fulfilmentLabel(row)}/></div>;}
