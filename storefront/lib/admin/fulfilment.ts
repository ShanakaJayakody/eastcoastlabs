import 'server-only';
import {adminDb} from './db';
import {parseCarrierCsv} from './carrier-csv';
export interface LotAssignment {lotId:string;lotCode:string;units:number;coa:{batchId:string;url:string}|null}
export interface FulfilmentLine {itemId:string;productName:string;variantLabel:string;poolId:string;poolName:string;requiredUnits:number;allocatedUnits:number;unallocatedUnits:number;allocations:LotAssignment[]}
export interface OrderFulfilment {orderId:string;editable:boolean;status:string;lines:FulfilmentLine[]}
export interface LotCatalog {
 pools:{id:string;name:string;onHand:number}[];
 lots:{id:string;poolId:string;code:string;units:number;availableUnits:number;receiptId:string|null;coaId:string|null}[];
 receipts:{id:string;poolId:string;units:number;createdAt:string}[];
 certificates:{id:string;batchId:string;compound:string}[];
}
export interface CarrierPreview {token:string|null;orderNumber:string;trackingNumber:string;status:string|null;currentTracking:string|null;error:string|null}
export interface CarrierOutcome {token:string;orderNumber:string;ok:boolean;replayed?:boolean;error?:string}
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await adminDb().rpc(name,args);
 if(error)throw new Error(error.message);
 if(data==null)throw new Error('Fulfilment record not found');
 return data as T;
}
export const getOrderFulfilment=(orderId:string)=>rpc<OrderFulfilment>('admin_order_fulfilment',{p_order:orderId});
export const getLotCatalog=()=>rpc<LotCatalog>('admin_lot_catalog');
export const registerStockLot=(input:{poolId:string;code:string;units:number;receiptId:string|null;coaId:string|null;evidence:string},actor:string)=>rpc<string>('admin_register_stock_lot',{p_pool:input.poolId,p_code:input.code,p_units:input.units,p_receipt:input.receiptId,p_coa:input.coaId,p_evidence:input.evidence,p_actor:actor});
export const allocateOrderLots=(orderId:string,itemId:string,poolId:string,assignments:{lotId:string;units:number}[],evidence:string,actor:string)=>rpc<{allocatedUnits:number;unallocatedUnits:number}>('admin_allocate_order_lots',{p_order:orderId,p_item:itemId,p_pool:poolId,p_assignments:assignments,p_evidence:evidence,p_actor:actor});
export const previewCarrierCsv=(csv:string)=>rpc<CarrierPreview[]>('admin_preview_carrier',{p_rows:parseCarrierCsv(csv)});
export const commitCarrierRows=(tokens:string[],notify:boolean,actor:string)=>rpc<CarrierOutcome[]>('admin_commit_carrier',{p_tokens:tokens,p_notify:notify,p_actor:actor});
