import 'server-only';
import { customerOrderEmailsEnabled } from '@/lib/customer-orders/flags';
import { orderViewPath } from '@/lib/customer-orders/tokens';
import { receiptImageUrl, trackingLink, CARRIERS } from '@/lib/customer-orders/presentation';
import { formatAud } from '@/lib/format';
import { EMAIL_SITE, EMAIL_STYLES, emailButton, escapeEmailHtml as esc } from './layout';
const TRANSACTIONS = new Set(['payment_instructions','payment_reminder','payment_expiring','payment_expired','order_confirmation','order_shipped','order_refunded']);
interface SummaryItem { id:string;name:string;size_label?:string;variant_label?:string;qty:number;refunded_qty:number;line_total_cents:number;discount_cents:number;image_url?:string;image_alt?:string;is_gift:boolean }
interface Summary {order_id:string;order_number:string;access_version:number;carrier_code?:string;tracking_number?:string;subtotal_cents:number;discount_cents:number;shipping_cents:number;total_cents:number;refunded_cents:number;items:SummaryItem[]}
const amount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const money = (value: number) => formatAud(value / 100);
const label = (value: unknown, max=180) => typeof value === 'string' ? value.slice(0,max) : '';
function parse(payload: Record<string, unknown>): Summary | null {
  const raw=payload.order_summary_v1;
  if (!raw || typeof raw !== 'object') return null;
  const s=raw as Summary;
  if (s.order_id !== payload.order_id || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s.order_id) || !amount(s.access_version) || s.access_version < 1 || typeof s.order_number !== 'string' || !Array.isArray(s.items)) return null;
  if (![s.subtotal_cents,s.discount_cents,s.shipping_cents,s.total_cents,s.refunded_cents].every(amount)) return null;
  if (!s.items.every(i=> i && typeof i.name==='string' && [i.qty,i.refunded_qty,i.line_total_cents,i.discount_cents].every(amount) && i.discount_cents<=i.line_total_cents)) return null;
  return s;
}
export function orderEmailSummary(template: string, payload: Record<string, unknown>): {html:string;text:string} | null {
  if (!customerOrderEmailsEnabled() || !TRANSACTIONS.has(template)) return null;
  const summary=parse(payload); if (!summary) return null;
  const url=EMAIL_SITE+orderViewPath(summary.order_id,summary.access_version);
  const visible=summary.items.slice(0,20);
  const rows=visible.map(item=> {
    const image=receiptImageUrl(item.image_url);
    const compatible=image && /\.(png|jpe?g)$/i.test(image) ? image : null;
    return `<tr><td width="72" valign="top" style="width:72px;padding:16px 12px 16px 0;">${compatible?`<img src="${esc(compatible)}" alt="${esc(label(item.image_alt||item.name))}" width="60" height="60" style="display:block;border:1px solid #e0e6eb;border-radius:6px;object-fit:contain;background:#f5f7f9;"/>`:''}</td><td valign="top" style="padding:16px 0;font-size:14px;line-height:1.6;overflow-wrap:anywhere;"><strong>${esc(label(item.name))}</strong><br/><span style="color:#52667a;">${esc([label(item.size_label),label(item.variant_label)].filter(Boolean).join(' · '))}<br/>Quantity ${item.qty}${item.is_gift?'<br/>Free gift':''}${item.refunded_qty?`<br/>Refunded: ${item.refunded_qty}`:''}</span></td><td align="right" valign="top" width="90" style="padding:16px 0 16px 10px;font-size:14px;white-space:nowrap;">${money(item.line_total_cents-item.discount_cents)}</td></tr>`;
  }).join('');
  const totals=[['Subtotal',money(summary.subtotal_cents)],...(summary.discount_cents?[['Discounts',`−${money(summary.discount_cents)}`]]:[]),['Shipping',summary.shipping_cents?money(summary.shipping_cents):'Free'],['Order total · AUD',money(summary.total_cents)],...(summary.refunded_cents?[['Refunded',money(summary.refunded_cents)],['Total after refunds',money(summary.total_cents-summary.refunded_cents)]]:[])];
  const tracking=typeof summary.tracking_number==='string'?label(summary.tracking_number,200):'';
  const trackingUrl=trackingLink(summary.carrier_code,tracking);
  const carrier=summary.carrier_code&&Object.hasOwn(CARRIERS,summary.carrier_code)?CARRIERS[summary.carrier_code].name:'Carrier';
  return {
    html:`${emailButton(url,'View your order')}${tracking?`<p style="${EMAIL_STYLES.paragraph}">${esc(carrier)}: ${trackingUrl?`<a href="${esc(trackingUrl)}" style="color:#275b88;">${esc(tracking)}</a>`:esc(tracking)}</p>`:''}<h2 style="font-size:19px;line-height:1.4;margin:32px 0 8px;">Your order · ${esc(label(summary.order_number))}</h2><table aria-label="Purchased items" cellpadding="0" cellspacing="0" width="100%" style="width:100%;table-layout:fixed;border-bottom:1px solid #dae3ea;">${rows}</table>${summary.items.length>20?`<p><a href="${esc(url)}">View all ${summary.items.length} items</a></p>`:''}<table aria-label="Order totals" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin-top:20px;font-size:14px;">${totals.map(([name,value])=>`<tr><th scope="row" align="left" style="padding:6px 0;font-weight:400;">${esc(name)}</th><td align="right" style="padding:6px 0;font-weight:600;">${esc(value)}</td></tr>`).join('')}</table>`,
    text:`Order ${summary.order_number}\nView your order: ${url}\n${tracking?`${carrier}: ${tracking}\n${trackingUrl||''}\n`:''}\n${visible.map(i=>`${label(i.name)} · ${[label(i.size_label),label(i.variant_label)].filter(Boolean).join(' · ')}\nQuantity ${i.qty}${i.is_gift?' · Free gift':''}${i.refunded_qty?` · Refunded: ${i.refunded_qty}`:''} · ${money(i.line_total_cents-i.discount_cents)}`).join('\n\n')}\n${summary.items.length>20?`View all ${summary.items.length} items: ${url}\n`:''}\n${totals.map(([name,value])=>`${name}: ${value}`).join('\n')}`,
  };
}
