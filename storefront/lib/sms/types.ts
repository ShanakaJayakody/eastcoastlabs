export interface AdminSmsSummary {
  reportDate: string; asOf: string; month: string;
  yesterdayRevenueCents: number; monthRevenueCents: number; overdueFulfilment: number;
  lowStockNames: string[];
}
export interface SmsRecipient { contactId: number; name: string; phone: string }
export interface FrozenSms {
  id: string; to_phone: string; sender: string; body: string; expected_parts: number;
  idempotency_key: string; credential_fingerprint: string;
}
export interface SmsOutboxRow extends FrozenSms {
  lease_token: string; kind: 'daily'|'test'; status: string;
  local_send_date: string; created_at: string; last_error: string|null;
}
export type SmsSendResult =
  | {kind:'accepted';messageId:string;credits:number}
  | {kind:'retryable'|'rejected'|'uncertain';reason:string};
export interface AdminSmsSettings { enabled: boolean; start_hour: number }
