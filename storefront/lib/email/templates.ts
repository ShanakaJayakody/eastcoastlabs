/** Plain, on-brand HTML email templates. No client tracking, no external assets. */
import type { EmailTemplate } from "@/lib/admin/email";
import { formatAud } from "@/lib/format";

const ACCENT = "#2fd4c8";
const INK = "#080b10";
const FG = "#e7ebf2";

function shell(preheader: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${INK};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" style="background:${INK};padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="480" style="background:#121821;border:1px solid #232c38;border-radius:12px;padding:32px;color:${FG};">
<tr><td>
<div style="font-weight:700;font-size:16px;letter-spacing:0.05em;color:${ACCENT};margin-bottom:24px;">EAST COAST LABS</div>
${body}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #232c38;font-size:11px;color:#667085;">
Research use only — not for human or animal consumption. East Coast Labs, Australia.
</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const cents = (c: number) => formatAud(c / 100);

export function renderTemplate(
  template: EmailTemplate,
  payload: Record<string, unknown>,
): { subject: string; html: string } {
  switch (template) {
    case "order_confirmation": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Order confirmed — ${orderNumber}`,
        html: shell(
          `Your order ${orderNumber} is confirmed.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Thanks — your order is in</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Order <strong style="font-family:monospace;">${orderNumber}</strong> is confirmed. We'll email bank-transfer
             details separately, and you'll get another note the moment it ships with the batch COA.
           </p>`,
        ),
      };
    }
    case "order_shipped": {
      const orderNumber = String(payload.order_number ?? "");
      const tracking = payload.tracking_number ? String(payload.tracking_number) : null;
      return {
        subject: `Shipped — ${orderNumber}`,
        html: shell(
          `${orderNumber} is on its way.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Your order has shipped</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Order <strong style="font-family:monospace;">${orderNumber}</strong> is on its way in discreet packaging.
             ${tracking ? `<br/>Tracking: <strong style="font-family:monospace;">${tracking}</strong>` : ""}
           </p>`,
        ),
      };
    }
    case "order_refunded": {
      const orderNumber = String(payload.order_number ?? "");
      const amount = typeof payload.amount_cents === "number" ? cents(payload.amount_cents) : null;
      return {
        subject: `Refund processed — ${orderNumber}`,
        html: shell(
          `A refund for ${orderNumber} has been processed.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Refund processed</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             ${amount ? `${amount} has` : "A refund has"} been processed for order
             <strong style="font-family:monospace;">${orderNumber}</strong>. Funds typically appear in 3-5 business days.
           </p>`,
        ),
      };
    }
    case "back_in_stock": {
      const name = String(payload.product_name ?? "This product");
      const url = String(payload.url ?? "/shop");
      return {
        subject: `${name} is back in stock`,
        html: shell(
          `${name} is back in stock.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Back in stock</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             <strong>${name}</strong>${payload.variant_label ? ` (${payload.variant_label})` : ""} is back — the batch
             COA is already published.
           </p>
           <a href="https://eastcoastlabs.com.au${url}" style="display:inline-block;margin-top:16px;background:${ACCENT};color:${INK};font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">Shop now</a>`,
        ),
      };
    }
    case "abandoned_cart": {
      const items = Array.isArray(payload.cart) ? (payload.cart as { name?: string; quantity?: number }[]) : [];
      const lines = items
        .map((l) => `<li style="margin:4px 0;">${l.name ?? "Item"} × ${l.quantity ?? 1}</li>`)
        .join("");
      return {
        subject: "You left something in your cart",
        html: shell(
          "You left something in your cart.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Still thinking it over?</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">Your cart is saved and ready:</p>
           <ul style="color:#c3ccd9;font-size:14px;padding-left:20px;">${lines}</ul>
           <a href="https://eastcoastlabs.com.au/shop" style="display:inline-block;margin-top:16px;background:${ACCENT};color:${INK};font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">Complete your order</a>`,
        ),
      };
    }
    default:
      return { subject: "East Coast Labs", html: shell("", "<p>Notification.</p>") };
  }
}
