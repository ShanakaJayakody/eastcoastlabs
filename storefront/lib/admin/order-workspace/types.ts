import type { OrderStatus } from '@/lib/admin/orders';

export type OrderView = OrderStatus | 'to_fulfil' | 'needs_attention' | 'all';
export type WorkspaceSort = 'created_at' | 'paid_at' | 'waiting_seconds' |
  'order_number' | 'total_cents' | 'status';
export type OrderColumn = 'identity' | 'items' | 'payment' | 'fulfilment' |
  'shipping' | 'waiting' | 'placed' | 'total';
export type OrderIssue = 'address_incomplete' | 'timing_incomplete' |
  'tracking_missing' | 'quantity_unknown' | 'refund_transfer_pending';
export type ShippingFilter = 'any' | 'standard' | 'express';

export interface OrderWorkspaceParams {
  status: OrderView;
  q: string;
  from: string;
  to: string;
  discount: string;
  shipping: ShippingFilter;
  sort: WorkspaceSort;
  dir: 'asc' | 'desc';
  explicitSort: boolean;
  page: number;
  order: string | null;
  columns: OrderColumn[] | null;
  density: 'comfortable' | 'compact' | null;
}

export interface OrderItemSummary {
  id: string;
  product_name: string | null;
  variant_label: string | null;
  size_label: string | null;
  sku: string | null;
  qty: number;
  refunded_qty: number;
}

export interface OrderWorkspaceRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string;
  total_cents: number;
  refunded_cents: number;
  refund_settled_cents: number;
  created_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  tracking_number: string | null;
  shipping_method: 'standard' | 'express';
  destination: string | null;
  line_count: number;
  items: OrderItemSummary[];
  ordered_physical_units: number | null;
  remaining_physical_units: number | null;
  waiting_seconds: number | null;
  issue_keys: OrderIssue[];
  has_notes: boolean;
}

export interface OrderWorkspacePage {
  rows: OrderWorkspaceRow[];
  total: number;
  counts: Record<OrderView, number>;
  as_of: string;
  page: number;
  page_size: 25;
}

export interface OrderLabel {
  label: string;
  detail: string | null;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'critical';
}

export interface StoredOrderView {
  id: string;
  name: string;
  filters: Pick<OrderWorkspaceParams, 'status' | 'from' | 'to' |
    'discount' | 'shipping' | 'sort' | 'dir' | 'explicitSort'>;
  columns: OrderColumn[];
  density: 'comfortable' | 'compact';
}

export interface OrderPreferences {
  version: 1;
  columns: OrderColumn[] | null;
  density: 'comfortable' | 'compact';
  views: StoredOrderView[];
}

export interface OrderPreview {
 order:import('@/lib/admin/order-queries').OrderDetail;
 fulfilment:import('@/lib/admin/fulfilment').OrderFulfilment;
 facts:OrderWorkspaceRow;
}
