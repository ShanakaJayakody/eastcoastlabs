/** Plain, on-brand HTML email templates. No client tracking, no external assets. */
import type { EmailTemplate } from "@/lib/admin/email";
import { formatAud } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { buildInstructions, isPaymentMethod, type PaymentInstructions } from "@/lib/payments";

const ACCENT = "#2fd4c8";
const INK = "#080b10";
const FG = "#e7ebf2";

function shell(preheader: string, body: string, unsubscribeUrl?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${INK};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" style="background:${INK};padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="480" style="background:#121821;border:1px solid #232c38;border-radius:12px;padding:32px;color:${FG};">
<tr><td>
<div style="font-weight:700;font-size:16px;letter-spacing:0.05em;color:${ACCENT};margin-bottom:24px;">EAST COAST LABS</div>
${body}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #232c38;font-size:11px;color:#667085;">
Research use only — not for human or animal consumption. East Coast Labs, Australia.${
    unsubscribeUrl
      ? `<br/><a href="${unsubscribeUrl}" style="color:#667085;text-decoration:underline;">Unsubscribe from marketing emails</a>`
      : ""
  }
</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** Unsubscribe URL from a marketing sweep's payload, if the sweep supplied one. */
const unsubOf = (payload: Record<string, unknown>): string | undefined =>
  typeof payload.unsubscribe_url === "string" && payload.unsubscribe_url !== ""
    ? payload.unsubscribe_url
    : undefined;

const cents = (c: number) => formatAud(c / 100);

const SITE = "https://eastcoastlabs.com.au";

/** Monitored support inbox — the same address the site footer publishes. */
const SUPPORT_EMAIL = "eclpeptides@gmail.com";

/** Payment details as a two-column table — the same fields the pay page shows. */
function instructionsTable(ins: PaymentInstructions): string {
  const rows = ins.fields
    .map(
      (f) => `<tr>
        <td style="padding:8px 12px 8px 0;color:#8b96a8;font-size:13px;white-space:nowrap;">${f.label}</td>
        <td style="padding:8px 0;color:${FG};font-size:15px;font-weight:600;${
          f.mono ? "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;" : ""
        }">${f.value}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" style="width:100%;margin:16px 0;background:#0d131b;border:1px solid #232c38;border-radius:8px;padding:8px 16px;">${rows}</table>`;
}

function notesList(notes: string[]): string {
  return `<ul style="color:#8b96a8;font-size:13px;line-height:1.7;padding-left:18px;margin:12px 0 0;">
    ${notes.map((n) => `<li style="margin:6px 0;">${n}</li>`).join("")}
  </ul>`;
}

/** Resolve the payment block for an order-payment email, or null if the method
 *  is no longer configured (details cleared after the order was placed). */
async function paymentBlock(payload: Record<string, unknown>): Promise<{
  instructions: PaymentInstructions | null;
  payUrl: string;
}> {
  const method = isPaymentMethod(payload.payment_method) ? payload.payment_method : "bank_transfer";
  const reference = String(payload.reference ?? payload.order_number ?? "");
  const amountCents = Number(payload.amount_cents ?? 0);
  const settings = await getSettings();
  return {
    instructions: buildInstructions(method, { reference, amountCents, settings }),
    payUrl: `${SITE}/pay/${String(payload.order_id ?? "")}`,
  };
}

const payButton = (url: string, label: string) =>
  `<a href="${url}" style="display:inline-block;margin-top:20px;background:${ACCENT};color:${INK};font-weight:600;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:14px;">${label}</a>`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const withParam = (url: string, key: string, value: string) =>
  `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;

/**
 * Five tappable stars, each deep-linking to the review form with that rating
 * pre-selected. Tapping a star is a far smaller first commitment than "write a
 * review", and it carries the rating across so the form opens half-finished.
 */
const starRow = (reviewUrl: string) =>
  `<table role="presentation" style="margin:20px 0;"><tr>${[1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<td style="padding-right:6px;"><a href="${withParam(reviewUrl, "rating", String(n))}" style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;font-size:20px;text-decoration:none;color:${ACCENT};background:#0d131b;border:1px solid #232c38;border-radius:8px;">&#9733;</a></td>`,
    )
    .join("")}</tr></table>
   <div style="color:#8b96a8;font-size:12px;margin-top:-8px;">Tap a star to open the form with your rating filled in.</div>`;

/**
 * The products from the order, prose-joined and escaped — or null when the sweep
 * supplied none. Naming what someone actually bought is the difference between a
 * form letter and a real question, so every review touch uses this.
 */
function productNames(payload: Record<string, unknown>): string | null {
  const names = Array.isArray(payload.products)
    ? (payload.products as unknown[]).filter((n): n is string => typeof n === "string" && n !== "")
    : [];
  if (!names.length) return null;
  if (names.length === 1) return esc(names[0]);
  return `${names.slice(0, -1).map(esc).join(", ")} and ${esc(names[names.length - 1])}`;
}

export async function renderTemplate(
  template: EmailTemplate,
  payload: Record<string, unknown>,
): Promise<{ subject: string; html: string }> {
  switch (template) {
    case "payment_instructions": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      return {
        subject: `Payment details for ${orderNumber} — ${amount}`,
        html: shell(
          `Transfer ${amount} to complete order ${orderNumber}.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Your order is reserved — here's how to pay</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Order <strong style="font-family:monospace;">${orderNumber}</strong> is held for you. Transfer
             <strong>${amount}</strong> using the details below and we'll dispatch as soon as it lands.
           </p>
           ${
             instructions
               ? instructionsTable(instructions) + notesList(instructions.notes)
               : `<p style="color:#c3ccd9;font-size:14px;line-height:1.6;">Reply to this email and we'll send your payment details.</p>`
           }
           ${payButton(payUrl, "View payment details")}`,
        ),
      };
    }

    case "payment_reminder": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      const hoursLeft = Number(payload.hours_left ?? 0);
      return {
        subject: `Reminder: ${orderNumber} is waiting for payment`,
        html: shell(
          `We're still holding ${orderNumber} for you.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Still holding your order</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             We haven't seen a transfer for <strong style="font-family:monospace;">${orderNumber}</strong> yet.
             Your items stay reserved for about <strong>${hoursLeft} more ${hoursLeft === 1 ? "hour" : "hours"}</strong>,
             then they go back on sale.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Already paid? Ignore this — some transfers take a few hours to appear, and a first PayID
             payment to a new payee can be held by your bank for up to 24 hours.
           </p>
           ${
             instructions
               ? instructionsTable(instructions)
               : `<p style="color:#c3ccd9;font-size:14px;">Reply to this email for payment details.</p>`
           }
           ${payButton(payUrl, `Pay ${amount}`)}`,
        ),
      };
    }

    case "payment_expiring": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      const hoursLeft = Math.max(1, Number(payload.hours_left ?? 0));
      return {
        // The last thing we send before the reservation goes. It has to read as
        // a deadline, not a third polite reminder — the two earlier nudges
        // already used up the polite register.
        subject: `Last chance: ${orderNumber} is released in ${hoursLeft} ${hoursLeft === 1 ? "hour" : "hours"}`,
        html: shell(
          `${orderNumber} is released in about ${hoursLeft} ${hoursLeft === 1 ? "hour" : "hours"}.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Your order is about to be released</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             <strong style="font-family:monospace;">${orderNumber}</strong> is still unpaid. We're holding
             your items for about <strong>${hoursLeft} more ${hoursLeft === 1 ? "hour" : "hours"}</strong>.
             After that the order is cancelled and the stock goes back on sale — we can't promise it
             will still be there afterwards.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Already paid? Nothing to do — transfers can take a few hours to show up, and a first
             PayID payment to a new payee can be held by your bank for up to 24 hours. If it lands
             late, reply to this email and we'll reinstate the order.
           </p>
           ${
             instructions
               ? instructionsTable(instructions)
               : `<p style="color:#c3ccd9;font-size:14px;">Reply to this email for payment details.</p>`
           }
           ${payButton(payUrl, `Pay ${amount} now`)}`,
        ),
      };
    }

    case "payment_expired": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Order ${orderNumber} released`,
        html: shell(
          `${orderNumber} has been released.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">We've released your order</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             We didn't receive payment for <strong style="font-family:monospace;">${orderNumber}</strong>, so the
             stock has gone back on sale. Nothing was charged and there's nothing to cancel.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Still want it? Ordering again takes a minute — or reply to this email if your transfer is
             on its way and we'll sort it out.
           </p>
           ${payButton(`${SITE}/shop`, "Back to the shop")}`,
        ),
      };
    }
  }

  switch (template) {
    case "order_confirmation": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Order confirmed — ${orderNumber}`,
        html: shell(
          `Your order ${orderNumber} is confirmed.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Thanks — your order is in</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Order <strong style="font-family:monospace;">${orderNumber}</strong> is confirmed and paid. You'll get
             another note the moment it ships, with your tracking number.
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
             <strong>${name}</strong>${payload.variant_label ? ` (${payload.variant_label})` : ""} is back in stock.
           </p>
           ${payButton(`${SITE}${url}`, "Shop now")}`,
          unsubOf(payload),
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
           <a href="${SITE}/shop" style="display:inline-block;margin-top:16px;background:${ACCENT};color:${INK};font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">Complete your order</a>`,
          unsubOf(payload),
        ),
      };
    }
    case "abandoned_cart_2": {
      return {
        subject: "Still thinking it over?",
        html: shell(
          "Your cart is still saved — here's why researchers choose us.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Doing your due diligence? Good.</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Your cart is still saved. Here's what to know before you decide:
           </p>
           <ul style="color:#c3ccd9;font-size:14px;line-height:1.8;padding-left:20px;">
             <li>Australian-owned and operated, dispatched within 1 business day</li>
             <li>Plain, discreet packaging and billing on every order</li>
             <li>Free shipping over $150</li>
           </ul>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Pick up where you left off whenever you're ready.
           </p>
           ${payButton(`${SITE}/shop`, "Complete your order")}`,
          unsubOf(payload),
        ),
      };
    }
    case "abandoned_cart_3": {
      return {
        subject: "Last note about your saved cart",
        html: shell(
          "We'll stop reminding you after this one.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Last call on your cart</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             This is the last reminder we'll send — your cart stays saved, but we won't email you about it again.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             First order with us? Code <strong style="font-family:monospace;">WELCOME10</strong> takes 10% off at checkout.
           </p>
           ${payButton(`${SITE}/shop`, "Complete your order")}`,
          unsubOf(payload),
        ),
      };
    }
    case "welcome_1": {
      return {
        subject: "Your 10% off code is inside",
        html: shell(
          "Welcome to East Coast Labs — research peptides dispatched from Australia.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Welcome — here's your code</h1>
           <div style="margin:16px 0;background:#0d131b;border:1px solid #232c38;border-radius:8px;padding:16px;text-align:center;">
             <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:0.1em;color:${ACCENT};">WELCOME10</span>
             <div style="color:#8b96a8;font-size:12px;margin-top:6px;">10% off your first order</div>
           </div>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             We do things differently from most peptide suppliers:
           </p>
           <ul style="color:#c3ccd9;font-size:14px;line-height:1.8;padding-left:20px;">
             <li>Australian-owned and operated, dispatched within 1 business day</li>
             <li>Plain, discreet packaging and billing on every order</li>
             <li>Free shipping over $150</li>
           </ul>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             No fabricated reviews. No fake sale prices. No "limited time" pressure tactics. Just
             straightforward research peptides, dispatched fast.
           </p>
           ${payButton(`${SITE}/shop`, "Shop bestsellers")}`,
          unsubOf(payload),
        ),
      };
    }
    case "welcome_3": {
      return {
        subject: "Most-ordered peptides — with per-vial savings",
        html: shell(
          "Buy in 3 or 6-vial packs and save up to 20% per vial.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Pack pricing, explained</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Every peptide is available in 1-vial, 3-pack, and 6-pack options — the more you buy, the less you
             pay per vial. 3-packs save 10% per vial; 6-packs save 20% and include free bacteriostatic water
             and free Express Post.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Your <strong style="font-family:monospace;">WELCOME10</strong> code still works on any of them.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "arrival_checkin": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Did ${orderNumber} arrive OK?`,
        html: shell(
          "Quick check that your order landed as it should have.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Did everything arrive OK?</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Order <strong style="font-family:monospace;">${orderNumber}</strong> shipped a few days ago, so it
             should be with you by now. This is a real check-in, not a sales email — if anything is
             missing, damaged, or still hasn't turned up, tell us and we'll sort it out.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             All good? Nothing to do. We'll be in touch once more in a couple of weeks to ask how we did.
           </p>
           ${payButton(
             `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Problem with order ${orderNumber}`)}`,
             "Something's not right",
           )}`,
          unsubOf(payload),
        ),
      };
    }
    case "post_purchase_review": {
      const orderNumber = String(payload.order_number ?? "");
      const reviewUrl = typeof payload.review_url === "string" ? payload.review_url : `${SITE}/leave-a-review`;
      const bought = productNames(payload);
      return {
        subject: "How was your order from East Coast Labs?",
        html: shell(
          "Share your experience — honest feedback only.",
          `<h1 style="font-size:20px;margin:0 0 8px;">How did we do?</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Your order <strong style="font-family:monospace;">${orderNumber}</strong>${
               bought ? ` — ${bought} —` : ""
             } was delivered about two weeks ago. We'd value your honest review. We're specifically interested in:
           </p>
           <ul style="color:#c3ccd9;font-size:14px;line-height:1.8;padding-left:20px;">
             <li>Dispatch speed — did your order arrive when expected?</li>
             <li>Packaging — was it discreet and secure?</li>
             <li>Overall experience — would you order again?</li>
           </ul>
           ${starRow(reviewUrl)}
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Every review helps other researchers make informed decisions. We never edit or remove reviews
             based on rating — honest feedback only.
           </p>
           ${payButton(reviewUrl, "Leave a review")}`,
          unsubOf(payload),
        ),
      };
    }
    case "post_purchase_review_reminder": {
      const reviewUrl = typeof payload.review_url === "string" ? payload.review_url : `${SITE}/leave-a-review`;
      const bought = productNames(payload);
      return {
        subject: "One question, 30 seconds",
        html: shell(
          "Would you order from us again? Tap a star.",
          `<h1 style="font-size:20px;margin:0 0 8px;">One question before we leave you alone</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             We asked a couple of weeks ago and didn't hear back, which is completely fine. If you have
             thirty seconds, though: how was ${bought ? `the ${bought}` : "your order"}?
           </p>
           ${starRow(reviewUrl)}
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             A single sentence is plenty. This is the last time we'll ask about this order.
           </p>`,
          unsubOf(payload),
        ),
      };
    }
    case "review_thank_you": {
      const rating = Number(payload.rating ?? 0);
      return {
        subject: "Thanks for the review",
        html: shell(
          "Your review is with our team — here's what happens next.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Thank you — that genuinely helps</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Your ${rating >= 1 && rating <= 5 ? `${rating}-star ` : ""}review is with our team. We screen
             for spam and nothing else — we don't edit or drop reviews based on what they say — so it
             should appear on the product page shortly.
           </p>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Most people find us because someone they trust pointed them here. If you know another
             researcher weighing up suppliers, forwarding this email is the most useful thing you can do
             for them — and for us.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "replenishment": {
      const packSize = Number(payload.pack_size ?? 1);
      const items = Array.isArray(payload.items) ? (payload.items as { name?: string; qty?: number }[]) : [];
      const lines = items
        .map((l) => `<li style="margin:4px 0;">${l.name ?? "Item"} × ${l.qty ?? 1}</li>`)
        .join("");
      const weeks = packSize >= 6 ? "22 weeks" : packSize >= 3 ? "10 weeks" : "3 weeks";
      return {
        subject: "Time to restock? 10% off your next order",
        html: shell(
          `It's been about ${weeks} since your last order. Quick restock inside.`,
          `<h1 style="font-size:20px;margin:0 0 8px;">Running low on lab supplies?</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             It's been about ${weeks} since your last order. If your supply is getting low, restocking is quick.
           </p>
           ${lines ? `<p style="color:#c3ccd9;font-size:14px;">Your last order:</p><ul style="color:#c3ccd9;font-size:14px;padding-left:20px;">${lines}</ul>` : ""}
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Restock with code <strong style="font-family:monospace;">RESTOCK10</strong> for 10% off.
           </p>
           ${payButton(`${SITE}/shop`, "Reorder now")}`,
          unsubOf(payload),
        ),
      };
    }
    case "winback_60": {
      return {
        subject: "What's new at East Coast Labs",
        html: shell(
          "New compounds + pack options.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Since your last order</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">We haven't seen you in a while. Here's what's new:</p>
           <ul style="color:#c3ccd9;font-size:14px;line-height:1.8;padding-left:20px;">
             <li>Bulk pack pricing on every peptide — save up to 20% per vial in 6-packs</li>
             <li>Free shipping over $150 · 1-business-day dispatch from Australia</li>
           </ul>
           ${payButton(`${SITE}/shop`, "Shop now")}`,
          unsubOf(payload),
        ),
      };
    }
    case "winback_90": {
      return {
        subject: "10% off — come back and restock",
        html: shell(
          "Code RESTOCK10 for 10% off your next order.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Welcome back — 10% off</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             Use code <strong style="font-family:monospace;">RESTOCK10</strong> for 10% off your next order.
           </p>
           ${payButton(`${SITE}/shop`, "Shop peptides")}`,
          unsubOf(payload),
        ),
      };
    }
    case "second_purchase_nudge": {
      return {
        subject: "Time to reorder?",
        html: shell(
          "It's been about a month — reordering takes a minute.",
          `<h1 style="font-size:20px;margin:0 0 8px;">Thanks for your first order</h1>
           <p style="color:#c3ccd9;font-size:14px;line-height:1.6;">
             It's been about a month since your first order with us. Reordering takes a minute, and
             dispatch is within 1 business day.
           </p>
           ${payButton(`${SITE}/shop`, "Reorder now")}`,
          unsubOf(payload),
        ),
      };
    }
    default:
      return { subject: "East Coast Labs", html: shell("", "<p>Notification.</p>") };
  }
}
