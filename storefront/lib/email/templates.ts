/** Navy brand email templates. Shared public logo; no template-level tracking. */
import { orderEmailSummary } from "./order-summary";
import {recoveryLink} from "@/lib/recovery-token";
import { paymentPath, createOrderAccessToken } from "@/lib/order-access";
import type { EmailTemplate } from "@/lib/admin/email";
import { formatAud } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { buildInstructions, isPaymentMethod, type PaymentInstructions } from "@/lib/payments";

import { EMAIL_COLORS, EMAIL_SITE as SITE, EMAIL_STYLES as styles, emailShell, emailButton as payButton, escapeEmailHtml as esc } from "./layout";

const ACCENT = EMAIL_COLORS.accent;
const FG = EMAIL_COLORS.ink;

/** Unsubscribe URL from a marketing sweep's payload, if the sweep supplied one. */
const unsubOf = (payload: Record<string, unknown>): string | undefined =>
  typeof payload.unsubscribe_url === "string" && payload.unsubscribe_url !== ""
    ? payload.unsubscribe_url
    : undefined;

const cents = (c: number) => formatAud(c / 100);

/** Payment details as a two-column table — the same fields the pay page shows. */
function instructionsTable(ins: PaymentInstructions): string {
  const rows = ins.fields
    .map(
      (f) => `<tr>
        <th scope="row" align="left" valign="top" width="36%" style="padding:12px 12px 12px 0;color:${EMAIL_COLORS.muted};font-size:14px;line-height:1.5;font-weight:400;">${esc(f.label)}</th>
        <td valign="top" style="padding:12px 0;color:${FG};font-size:15px;line-height:1.5;font-weight:600;overflow-wrap:anywhere;word-break:break-word;${
          f.mono ? "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;" : ""
        }">${esc(f.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table aria-label="Payment details" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;margin:24px 0;background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;padding:8px 16px;">${rows}</table>`;
}

function notesList(notes: string[]): string {
  return `<ul style="color:${EMAIL_COLORS.muted};font-size:14px;line-height:1.7;padding-left:18px;margin:16px 0 0;">
    ${notes.map((n) => `<li style="margin:6px 0;">${esc(n)}</li>`).join("")}
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
    payUrl: `${SITE}${paymentPath(String(payload.order_id ?? ""))}`,
  };
}

function paymentDeadline(payload: Record<string, unknown>): string {
  const date = new Date(String(payload.payment_expires_at ?? ""));
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : "at the deadline shown on your payment page";
}

const withParam = (url: string, key: string, value: string) =>
  `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;

/**
 * Five tappable stars, each deep-linking to the review form with that rating
 * pre-selected. Tapping a star is a far smaller first commitment than "write a
 * review", and it carries the rating across so the form opens half-finished.
 */
const starRow = (reviewUrl: string) =>
  `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>${[1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<td style="padding:0 ${n === 5 ? 0 : 4}px 0 0;"><a href="${esc(withParam(reviewUrl, "rating", String(n)))}" aria-label="Rate your order ${n} out of 5" style="display:inline-block;width:42px;height:42px;line-height:42px;text-align:center;font-size:20px;text-decoration:none;color:${ACCENT};background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:4px;">&#9733;</a></td>`,
    )
    .join("")}</tr></table>
   <div style="color:${EMAIL_COLORS.muted};font-size:14px;margin-top:-8px;">Tap a star to open the form with your rating filled in.</div>`;

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

async function renderLegacyTemplate(
  template: EmailTemplate,
  payload: Record<string, unknown>,
  enrichment?: {html:string;text:string},
): Promise<{ subject: string; html: string }> {
  const settings = await getSettings();
  const SUPPORT_EMAIL = settings.supportEmail;
  const shell = (preheader: string, body: string, unsubscribeUrl?: string) => emailShell({
    preheader, body: body + (enrichment?.html ?? ""), unsubscribeUrl, supportEmail: settings.supportEmail,
    supportHours: settings.supportHours, audience: template.startsWith("admin_") ? "admin" : "customer",
  });
  switch (template) {
    case "admin_order_overdue": {
      const awaitingPayment = payload.queue === "awaiting_payment";
      const label = awaitingPayment ? "Awaiting payment" : "To fulfil";
      const number = String(payload.order_number ?? "");
      const hours = Math.max(24, Math.floor(Number(payload.hours_waiting) || 24));
      const action = awaitingPayment
        ? "Check the transfer and confirm payment if it has cleared, or follow up with the customer. Fulfil the order as soon as payment is confirmed."
        : "Pack and dispatch this order as soon as possible, then record its tracking details.";
      const subject = `[PRIORITY] ${number} overdue — ${label}`;
      return { subject, html: shell(subject,
        `<h1 style="${styles.heading}">Overdue order requires attention</h1>
        <p style="${styles.paragraph}"><strong>${esc(number)}</strong> has been in <strong>${label}</strong> for <strong>${hours} hours</strong>, exceeding the 24-hour action window.</p>
        <p style="${styles.paragraph}">${esc(String(payload.customer_name || "Customer"))} · ${cents(Number(payload.amount_cents) || 0)}</p>
        <p style="${styles.paragraph}">${action}</p>
        ${payButton(`${SITE}/admin/orders/${encodeURIComponent(String(payload.order_id ?? ""))}`, "Review order")}
        <p style="font-size:14px;color:${EMAIL_COLORS.muted};">Sent to all active admins. Reminders repeat every 24 hours while the order remains in this queue. Check the order for its latest status before taking action.</p>`) };
    }
    case "admin_daily_brief": {
      if (typeof payload.subject !== "string" || typeof payload.html !== "string") throw new Error("Invalid daily brief");
      return { subject:payload.subject,html:payload.html };
    }
    case "cart_recovery_confirmation": {
      const url = recoveryLink(String(payload.recovery_request_id ?? ""));
      return {subject:"Confirm your saved cart link",html:shell("Confirm your cart link and reminders.",
        `<h1 style="${styles.heading}">Confirm your saved cart</h1>
        <p style="${styles.paragraph}">Use this link within 24 hours and select Confirm and restore to save your cart and request reminders.</p>
        <p style="${styles.paragraph}">You may receive up to three reminders, at 1 hour, 24 hours and 72 hours after confirmation if still eligible. This does not subscribe you to the newsletter. Your restore link expires seven days after your request.</p>
        <p style="${styles.muted}">If you did not request this, you can ignore this email.</p>${payButton(url,"Confirm and restore cart")}`)};
    }
    case "subscription_confirmation": {
      const url = String(payload.confirmation_url ?? "");
      if (!url.startsWith(`${SITE}/subscribe/confirm?token=`)) throw new Error("Invalid confirmation link");
      return { subject: "Confirm your East Coast Labs subscription", html: shell("Confirm your email subscription.",
        `<h1 style="${styles.heading}">Confirm your subscription</h1><p style="${styles.paragraph}">Use this link within 24 hours to receive our email updates. If you did not request this, ignore this email.</p>${payButton(url, "Confirm subscription")}`) };
    }
    case "payment_instructions": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      return {
        subject: `Payment details for ${orderNumber} — ${amount}`,
        html: shell(
          `Transfer ${amount} to complete order ${orderNumber}.`,
          `<h1 style="${styles.heading}">Your order is reserved</h1>
           <p style="${styles.paragraph}">
             Order <strong style="font-family:monospace;">${esc(orderNumber)}</strong> is held for you. Transfer
             <strong>${amount}</strong> using the details below. We'll prepare your order once payment is confirmed.
           </p>
           ${
             instructions
               ? instructionsTable(instructions) + notesList(instructions.notes)
               : `<p style="${styles.paragraph}">Please contact us using the details below for help with payment.</p>`
           }
           ${payButton(payUrl, "View payment details")}`,
        ),
      };
    }

    case "payment_reminder": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      const deadline = paymentDeadline(payload);
      return {
        subject: `Reminder: ${orderNumber} is waiting for payment`,
        html: shell(
          `We're still holding ${orderNumber} for you.`,
          `<h1 style="${styles.heading}">Still holding your order</h1>
           <p style="${styles.paragraph}">
             We haven't yet confirmed payment for <strong style="font-family:monospace;">${esc(orderNumber)}</strong>.
             Your reservation ends <strong>${deadline}</strong>,
             after which the items are made available for other orders.
           </p>
           <p style="${styles.paragraph}">
             If you have already paid, no further payment is needed. Some transfers take a few hours to appear, and a first PayID
             payment to a new payee can be held by your bank for up to 24 hours.
           </p>
           ${
             instructions
               ? instructionsTable(instructions)
               : `<p style="${styles.paragraph}">Please contact us using the details below for help with payment.</p>`
           }
           ${payButton(payUrl, `View payment details — ${amount}`)}`,
        ),
      };
    }

    case "payment_expiring": {
      const orderNumber = String(payload.order_number ?? "");
      const { instructions, payUrl } = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      const deadline = paymentDeadline(payload);
      return {
        subject: `Payment deadline for ${orderNumber}`,
        html: shell(
          `${orderNumber}: reservation ends ${deadline}.`,
          `<h1 style="${styles.heading}">Your payment deadline is approaching</h1>
           <p style="${styles.paragraph}">
             <strong style="font-family:monospace;">${esc(orderNumber)}</strong> is still unpaid. We're holding
             your items until <strong>${deadline}</strong>.
             After that the order is cancelled and the stock goes back on sale — we can't promise it
             will still be there afterwards.
           </p>
           <p style="${styles.paragraph}">
             If you have already paid, no further payment is needed. Transfers can take a few hours to appear, and a first
             PayID payment to a new payee can be held by your bank for up to 24 hours. If it lands
             after the deadline, please contact us so we can check availability and help with your payment.
           </p>
           ${
             instructions
               ? instructionsTable(instructions)
               : `<p style="${styles.paragraph}">Please contact us using the details below for help with payment.</p>`
           }
           ${payButton(payUrl, `View payment details — ${amount}`)}`,
        ),
      };
    }

    case "payment_expired": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Order ${orderNumber} released`,
        html: shell(
          `${orderNumber} has been released.`,
          `<h1 style="${styles.heading}">We've released your order</h1>
           <p style="${styles.paragraph}">
             We didn't receive payment for <strong style="font-family:monospace;">${esc(orderNumber)}</strong>, so the
             items are available for other orders. If you have already sent a transfer, please contact us so we can check it.
           </p>
           <p style="${styles.paragraph}">
             You can place a new order using the link below. If your transfer is still processing, please contact us before ordering again.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
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
          `<h1 style="${styles.heading}">Your order is confirmed</h1>
           <p style="${styles.paragraph}">
             Order <strong style="font-family:monospace;">${esc(orderNumber)}</strong> is confirmed and paid. You'll get
             a dispatch email with tracking details once your order has shipped.
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
          `<h1 style="${styles.heading}">Your order has shipped</h1>
           <p style="${styles.paragraph}">
             Order <strong style="font-family:monospace;">${esc(orderNumber)}</strong> is on its way in discreet packaging.
             ${tracking ? `<br/>Tracking: <strong style="font-family:monospace;">${esc(tracking)}</strong>` : ""}
           </p>`,
        ),
      };
    }
    case "order_refunded": {
      const orderNumber = String(payload.order_number ?? "");
      const amount = typeof payload.amount_cents === "number" ? cents(payload.amount_cents) : null;
      return {
        subject: `Refund recorded — ${orderNumber}`,
        html: shell(
          `A refund for ${orderNumber} has been recorded.`,
          `<h1 style="${styles.heading}">Refund recorded</h1>
           <p style="${styles.paragraph}">
             ${amount ? `${amount} has` : "A refund has"} been recorded for order
             <strong style="font-family:monospace;">${esc(orderNumber)}</strong>. Please contact us if you need confirmation of the bank transfer.
           </p>`,
        ),
      };
    }
    case "back_in_stock": {
      const name = String(payload.product_name ?? "This product");
      const url = typeof payload.url === "string" && /^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.url) ? payload.url : "/shop";
      return {
        subject: `${name} is back in stock`,
        html: shell(
          `${name} is back in stock.`,
          `<h1 style="${styles.heading}">Back in stock</h1>
           <p style="${styles.paragraph}">
             <strong>${esc(name)}</strong>${payload.variant_label ? ` (${esc(String(payload.variant_label))})` : ""} is back in stock.
           </p>
           ${payButton(`${SITE}${url}`, "View current availability")}`,
          unsubOf(payload),
        ),
      };
    }
    case "abandoned_cart": {
      const items = Array.isArray(payload.cart) ? (payload.cart as { name?: string; quantity?: number }[]) : [];
      const lines = items
        .map((l) => `<li style="margin:4px 0;">${esc(l.name ?? "Item")} × ${l.quantity ?? 1}</li>`)
        .join("");
      return {
        subject: "Your saved cart at East Coast Labs",
        html: shell(
          "Review your saved items whenever you are ready.",
          `<h1 style="${styles.heading}">Your saved cart</h1>
           <p style="${styles.paragraph}">Your cart is saved and ready:</p>
           <ul style="${styles.list}">${lines}</ul>
           ${payButton(recoveryLink(String(payload.recovery_request_id ?? "")), "Return to your cart")}`,
          unsubOf(payload),
        ),
      };
    }
    case "abandoned_cart_2": {
      return {
        subject: "A reminder about your saved cart",
        html: shell(
          "Your saved items and useful ordering information.",
          `<h1 style="${styles.heading}">A little more information</h1>
           <p style="${styles.paragraph}">
             Your cart is still saved. Here's what to know before you decide:
           </p>
           <ul style="${styles.list}">
             <li>Dispatched from Australia after payment confirmation</li>
             <li>Plain, discreet packaging and billing on every order</li>
             <li>Free standard shipping from ${cents(Math.round(settings.freeShippingThreshold * 100))}</li>
           </ul>
           <p style="${styles.paragraph}">
             Pick up where you left off whenever you're ready.
           </p>
           ${payButton(`${recoveryLink(String(payload.recovery_request_id ?? ""))}`, "Return to your cart")}`,
          unsubOf(payload),
        ),
      };
    }
    case "abandoned_cart_3": {
      return {
        subject: "Your final saved-cart reminder",
        html: shell(
          "Your saved-cart link expires seven days after your request.",
          `<h1 style="${styles.heading}">Your final cart reminder</h1>
           <p style="${styles.paragraph}">
             This is the last reminder for this cart. Your restore link expires seven days after you requested it.
           </p>
           <p style="${styles.paragraph}">
             Review current prices and availability at checkout.
           </p>
           ${payButton(`${recoveryLink(String(payload.recovery_request_id ?? ""))}`, "Return to your cart")}`,
          unsubOf(payload),
        ),
      };
    }
    case "welcome_1": {
      return {
        subject: "Welcome to East Coast Labs — your first-order code",
        html: shell(
          "Welcome to East Coast Labs — research peptides dispatched from Australia.",
          `<h1 style="${styles.heading}">Welcome to East Coast Labs</h1>
           <div style="margin:16px 0;background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;padding:16px;text-align:center;">
             <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:0.1em;color:${ACCENT};">WELCOME10</span>
             <div style="color:${EMAIL_COLORS.muted};font-size:14px;margin-top:6px;">10% off your first order</div>
           </div>
           <p style="${styles.paragraph}">
             Thank you for joining us. Here is some useful information for your first order:
           </p>
           <ul style="${styles.list}">
             <li>Dispatched from Australia after payment confirmation</li>
             <li>Plain, discreet packaging and billing on every order</li>
             <li>Free standard shipping from ${cents(Math.round(settings.freeShippingThreshold * 100))}</li>
           </ul>
           <p style="${styles.paragraph}">
             Explore the range, check available product documentation and contact us if you have questions before ordering.
           </p>
           ${payButton(`${SITE}/shop`, "Explore the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "welcome_3": {
      return {
        subject: "A guide to pack options at East Coast Labs",
        html: shell(
          "Compare the available pack sizes and current pricing before ordering.",
          `<h1 style="${styles.heading}">Pack pricing, explained</h1>
           <p style="${styles.paragraph}">
             Available pack sizes and per-vial pricing are shown on each product page. Compare the options to find the quantity that suits your research requirements.
           </p>
           <p style="${styles.paragraph}">
             If you have not placed your first order yet, you can enter <strong style="font-family:monospace;">WELCOME10</strong> at checkout. Any eligible discount and shipping benefits will be shown before you confirm your order.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "arrival_checkin": {
      const orderNumber = String(payload.order_number ?? "");
      return {
        subject: `Checking in on order ${orderNumber}`,
        html: shell(
          "Checking in after dispatch — let us know if you need help.",
          `<h1 style="${styles.heading}">How was your delivery?</h1>
           <p style="${styles.paragraph}">
             Order <strong style="font-family:monospace;">${esc(orderNumber)}</strong> shipped recently. If anything is
             missing, damaged or has not arrived, please contact us so we can help.
           </p>
           <p style="${styles.paragraph}">
             If everything arrived as expected, there is nothing you need to do. Thank you for ordering with East Coast Labs.
           </p>
           ${payButton(
             `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Problem with order ${orderNumber}`)}`,
             "Contact us about your order",
           )}`,
          unsubOf(payload),
        ),
      };
    }
    case "post_purchase_review": {
      const orderNumber = String(payload.order_number ?? "");
      const reviewUrl = `${SITE}/leave-a-review?token=${createOrderAccessToken(String(payload.order_id ?? ""), "review")}`;
      const bought = productNames(payload);
      return {
        subject: "How was your order from East Coast Labs?",
        html: shell(
          "Did everything arrive OK? Let us know and share your honest review.",
          `<h1 style="${styles.heading}">Did everything arrive OK?</h1>
           <p style="${styles.paragraph}">
             We're checking in on order <strong style="font-family:monospace;">${esc(orderNumber)}</strong>${
               bought ? ` — ${bought} —` : ""
             }. Has everything arrived safely? If anything is missing, damaged, or still on its way,
             <a href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help with order ${orderNumber}`)}" style="color:${ACCENT};">contact us</a> so we can help.
           </p>
           <p style="${styles.paragraph}">
             We'd also value your honest review of your experience — all feedback is welcome. We're specifically interested in:
           </p>
           <ul style="${styles.list}">
             <li>Dispatch speed — did your order arrive when expected?</li>
             <li>Packaging — was it discreet and secure?</li>
             <li>Overall experience — would you order again?</li>
           </ul>
           ${starRow(reviewUrl)}
           <p style="${styles.paragraph}">
             Your feedback helps us improve our service and helps other researchers make informed decisions. We welcome honest feedback about your ordering experience.
           </p>
           ${payButton(reviewUrl, "Leave a review")}`,
          unsubOf(payload),
        ),
      };
    }
    case "post_purchase_review_reminder": {
      const reviewUrl = `${SITE}/leave-a-review?token=${createOrderAccessToken(String(payload.order_id ?? ""), "review")}`;
      const bought = productNames(payload);
      return {
        subject: "A final invitation to review your order",
        html: shell(
          "Share your experience of ordering from East Coast Labs.",
          `<h1 style="${styles.heading}">Your feedback is welcome</h1>
           <p style="${styles.paragraph}">
             If you have received your order and would like to share your experience, we would value your feedback on ${bought ? `your order of ${bought}` : "your order"}.
           </p>
           ${starRow(reviewUrl)}
           <p style="${styles.paragraph}">
             A single sentence is plenty. This is the last time we'll ask about this order.
           </p>`,
          unsubOf(payload),
        ),
      };
    }
    case "review_thank_you": {
      const rating = Number(payload.rating ?? 0);
      return {
        subject: "Thank you for your feedback",
        html: shell(
          "Your review is with our team — here's what happens next.",
          `<h1 style="${styles.heading}">Thank you for your review</h1>
           <p style="${styles.paragraph}">
             Your ${rating >= 1 && rating <= 5 ? `${rating}-star ` : ""}review is with our team for moderation. Thank you for taking the time to share your ordering experience.
           </p>
           <p style="${styles.paragraph}">
             Your feedback helps us understand what went well and where we can improve. If there is anything unresolved with your order, please contact us using the details below.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "replenishment": {
      const items = Array.isArray(payload.items) ? (payload.items as { name?: string; qty?: number; url?:string }[]) : [];
      const lines = items.map(item => {
        const url=typeof item.url==='string'&&/^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.url)?`${SITE}${item.url}`:null;
        return `<li style="margin:8px 0;">${esc(String(item.name??"Item"))} × ${Number.isInteger(item.qty)?item.qty:1}${url?` — <a href="${url}" style="color:${ACCENT};">View this product</a>`:''}</li>`;
      }).join('');
      return {
        subject: "Your reorder reminder",
        html: shell(
          "A reminder to review your research supply needs.",
          `<h1 style="${styles.heading}">Planning another research order?</h1>
           <p style="${styles.paragraph}">Here are the items from your previous order. Choose what your research requires; this reminder does not assume how much you have used.</p>
           ${lines ? `<ul style="${styles.list}">${lines}</ul>` : ""}
           ${payButton(`${SITE}/shop`, "Browse current availability")}`,
          unsubOf(payload),
        ),
      };
    }
    case "winback_60": {
      return {
        subject: "Explore the East Coast Labs range",
        html: shell(
          "Review current availability, pack sizes and pricing.",
          `<h1 style="${styles.heading}">Since your last order</h1>
           <p style="${styles.paragraph}">If you are planning another research order, you can review the current range and available pack options.</p>
           <ul style="${styles.list}">
             <li>Compare available pack sizes and per-vial pricing on each product page</li>
             <li>Free standard shipping from ${cents(Math.round(settings.freeShippingThreshold * 100))} · dispatch from Australia after payment confirmation</li>
           </ul>
           ${payButton(`${SITE}/shop`, "View current availability")}`,
          unsubOf(payload),
        ),
      };
    }
    case "winback_90": {
      return {
        subject: "Your next order at East Coast Labs — 10% off",
        html: shell(
          "Code RESTOCK10 for 10% off your next order.",
          `<h1 style="${styles.heading}">Welcome back — 10% off</h1>
           <p style="${styles.paragraph}">
             Use code <strong style="font-family:monospace;">RESTOCK10</strong> for 10% off your next order.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    case "second_purchase_nudge": {
      return {
        subject: "Planning your next research order?",
        html: shell(
          "Browse current availability when you are ready to order again.",
          `<h1 style="${styles.heading}">Thanks for your first order</h1>
           <p style="${styles.paragraph}">
             Thank you for choosing East Coast Labs. When you are ready to plan another research order, you can review current availability and pack options using the link below.
           </p>
           ${payButton(`${SITE}/shop`, "Browse the range")}`,
          unsubOf(payload),
        ),
      };
    }
    default:
      return { subject: "East Coast Labs", html: shell("", `<p style="${styles.paragraph}">Notification.</p>`) };
  }
}

export async function renderTemplate(template: EmailTemplate, payload: Record<string, unknown>): Promise<{subject:string;html:string;text?:string;replyTo?:string}> {
  const enrichment=orderEmailSummary(template,payload);
  const result=await renderLegacyTemplate(template,payload,enrichment??undefined);
  if (!enrichment) return result;
  const settings=await getSettings();
  // Text is generated from the exact rendered message, preserving bank details,
  // deadlines, and all event-specific wording when HTML is unavailable.
  const text=result.html.replace(/<head[\s\S]*?<\/head>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,(_,href:string,body:string)=>`${body}: ${href}`)
    .replace(/<(br\s*\/?|\/p|\/div|\/tr|\/h[1-6]|\/li)>/gi,'\n').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return {...result,text,replyTo:settings.supportEmail};
}
