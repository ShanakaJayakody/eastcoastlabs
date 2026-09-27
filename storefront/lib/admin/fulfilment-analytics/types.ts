export type Grain='week'|'month';
export type Statistic='median'|'mean'|'p90';
export type Metric='payment'|'fulfilment'|'total';
export type TimingView='waiting'|'unpaid'|'payments'|'shipments'|'quality';
export type TimingSort='wait'|'payment'|'fulfilment'|'total'|'milestone';
export interface Stats {n:number;median:number|null;mean:number|null;p90:number|null;max:number|null}
export interface Summary {payment:Stats;fulfilment:Stats;total:Stats;paid_count:number;shipped_count:number;distribution:number[]}
export interface Period extends Summary {key:string;start_at:string;end_at:string;calendar_start:string;calendar_end:string;partial:string[]}
export interface MatchedComparison {current_start:string;current_end:string;previous_start:string;previous_end:string;provisional:boolean;current:Summary;previous:Summary}
export interface FulfilmentReport {as_of:string;first_order_at:string|null;from:string;to:string;grain:Grain;range:string;summary:Summary;periods:Period[];queues:{paid:number;unpaid:number};quality:{missing_payment:number;missing_shipment:number;invalid_payment:number;invalid_fulfilment:number;invalid_total:number;future_timestamps:number;affected_orders:number};matched:MatchedComparison|null}
export interface TimingOrder {id:string;order_number:string;customer_name:string|null;status:string;created_at:string;paid_at:string|null;shipped_at:string|null;payment_seconds:number|null;fulfilment_seconds:number|null;total_seconds:number|null;payment_wait_seconds:number|null;fulfilment_wait_seconds:number|null;total_wait_seconds:number|null;quality_issue:boolean}
export interface TimingPage {as_of:string;total:number;rows:TimingOrder[]}
export interface FulfilmentParams {tab:'overview'|'trends'|'orders';grain:Grain;range:'all'|'12w'|'12m'|'custom';from:string|null;to:string|null;stat:Statistic;comparison:'complete'|'matched';view:TimingView;sort:TimingSort;dir:'asc'|'desc';page:number;metric:Metric|null;period:string|null}
export const METRICS: {key:Metric;label:string;basis:string}[]=[
 {key:'payment',label:'Placed → paid',basis:'Payment confirmed in period'},
 {key:'fulfilment',label:'Paid → marked shipped',basis:'Marked shipped in period'},
 {key:'total',label:'Placed → marked shipped',basis:'Marked shipped in period'},
];
