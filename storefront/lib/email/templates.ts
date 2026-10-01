/** Customer copy shares the navy shell, receipt enrichment and delivery safeguards. */
import { orderEmailSummary } from './order-summary';
import { recoveryLink } from '@/lib/recovery-token';
import { paymentPath, createOrderAccessToken } from '@/lib/order-access';
import type { EmailTemplate } from '@/lib/admin/email';
import { formatAud } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { buildInstructions, isPaymentMethod, type PaymentInstructions } from '@/lib/payments';
import { EMAIL_COLORS, EMAIL_SITE as SITE, EMAIL_TELEGRAM, EMAIL_STYLES as styles,
  emailShell, emailButton as button, escapeEmailHtml as esc } from './layout';

const cents = (value: number) => formatAud(value / 100);
/** Callers escape interpolated values; the surrounding markup is trusted. */
const paragraph = (html: string) => `<p style="${styles.paragraph}">${html}</p>`;
const heading = (text: string) => `<h1 style="${styles.heading}">${esc(text)}</h1>${paragraph('Hi there,')}`;
const orderNumber = (payload: Record<string, unknown>) => `<strong style="font-family:monospace;">${esc(String(payload.order_number ?? ''))}</strong>`;
const unsubOf = (payload: Record<string, unknown>): string | undefined =>
  typeof payload.unsubscribe_url === 'string' && payload.unsubscribe_url !== '' ? payload.unsubscribe_url : undefined;

// Cart/stock requests and transactional messages are not a general marketing
// subscription. Their shared footer offers support, without the promo invitation.
const COMMUNITY_TEMPLATES = new Set<EmailTemplate>([
  'welcome_1', 'welcome_3', 'arrival_checkin', 'post_purchase_review', 'review_thank_you',
  'replenishment', 'second_purchase_nudge', 'winback_60', 'winback_90',
]);
function communityInvitation(template: EmailTemplate): string {
  if (!COMMUNITY_TEMPLATES.has(template)) return '';
  const welcome = template === 'welcome_1';
  return `<div style="margin-top:28px;padding-top:24px;border-top:1px solid ${EMAIL_COLORS.line};">
    <h2 style="margin:0 0 12px;font-size:19px;line-height:1.4;color:${EMAIL_COLORS.ink};">${welcome ? 'Come and join us on Telegram' : 'Keep in touch with our community'}</h2>
    ${paragraph(welcome
      ? "We'd love to see you in our Telegram community. It's a place to ask questions, get 24/7 support, hear about community promos and updates, and share your experiences with East Coast Labs."
      : "Join us on Telegram for community promos, updates, shared experiences and 24/7 support. We'd love to have you with us.")}
    ${welcome ? paragraph("Whether you have something to ask or simply want to be part of the conversation, you're welcome to join us.") : ''}
    ${button(EMAIL_TELEGRAM, 'Join us on Telegram')}
  </div>`;
}

function instructionsTable(ins: PaymentInstructions): string {
  const rows = ins.fields.map(field => `<tr>
    <th scope="row" align="left" valign="top" width="36%" style="padding:12px 12px 12px 0;color:${EMAIL_COLORS.muted};font-size:14px;line-height:1.5;font-weight:400;">${esc(field.label)}</th>
    <td valign="top" style="padding:12px 0;color:${EMAIL_COLORS.ink};font-size:15px;line-height:1.5;font-weight:600;overflow-wrap:anywhere;word-break:break-word;${field.mono ? 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;' : ''}">${esc(field.value)}</td>
  </tr>`).join('');
  return `<table aria-label="Payment details" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;margin:24px 0;background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;padding:8px 16px;">${rows}</table>`;
}

async function paymentBlock(payload: Record<string, unknown>) {
  const method = isPaymentMethod(payload.payment_method) ? payload.payment_method : 'bank_transfer';
  const settings = await getSettings();
  return {
    instructions: buildInstructions(method, { reference: String(payload.reference ?? payload.order_number ?? ''), amountCents: Number(payload.amount_cents ?? 0), settings }),
    payUrl: `${SITE}${paymentPath(String(payload.order_id ?? ''))}`,
  };
}

function paymentDeadline(payload: Record<string, unknown>): string {
  const date = new Date(String(payload.payment_expires_at ?? ''));
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : 'at the deadline shown on your payment page';
}

const withParam = (url: string, key: string, value: string) => `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
const starRow = (reviewUrl: string) =>
  `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>${[1, 2, 3, 4, 5].map(n =>
    `<td style="padding:0 ${n === 5 ? 0 : 4}px 0 0;"><a href="${esc(withParam(reviewUrl, 'rating', String(n)))}" aria-label="Rate your order ${n} out of 5" style="display:inline-block;width:42px;height:42px;line-height:42px;text-align:center;font-size:20px;text-decoration:none;color:${EMAIL_COLORS.accent};background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:4px;">&#9733;</a></td>`
  ).join('')}</tr></table><div style="color:${EMAIL_COLORS.muted};font-size:14px;margin-top:-8px;">Tap a star to open the form with your rating filled in.</div>`;

function productNames(payload: Record<string, unknown>): string | null {
  const names = Array.isArray(payload.products) ? payload.products.filter((name): name is string => typeof name === 'string' && name !== '') : [];
  if (!names.length) return null;
  if (names.length === 1) return esc(names[0]);
  return `${names.slice(0, -1).map(esc).join(', ')} and ${esc(names[names.length - 1])}`;
}

async function renderLegacyTemplate(template: EmailTemplate, payload: Record<string, unknown>, enrichment?: {html:string;text:string}): Promise<{subject:string;html:string}> {
  const settings = await getSettings();
  const admin = template.startsWith('admin_');
  const support = `<a href="mailto:${esc(settings.supportEmail)}" style="color:${EMAIL_COLORS.accent};">${esc(settings.supportEmail)}</a>`;
  const shell = (preheader: string, body: string, unsubscribeUrl?: string) => emailShell({
    preheader,
    body: body + (enrichment?.html ?? '') + (admin ? '' : paragraph('The East Coast Labs team') + communityInvitation(template)),
    unsubscribeUrl, supportEmail: settings.supportEmail, supportHours: settings.supportHours,
    audience: admin ? 'admin' : 'customer',
  });
  const message = (subject: string, preheader: string, title: string, body: string) => ({
    subject, html: shell(preheader, heading(title) + body, unsubOf(payload)),
  });
  const number = String(payload.order_number ?? '');
  const order = orderNumber(payload);
  const orderPageNote = enrichment ? paragraph('You can review your items and see the latest order status using the private link below.') : '';

  switch (template) {
    case 'admin_order_overdue': {
      const awaitingPayment = payload.queue === 'awaiting_payment';
      const label = awaitingPayment ? 'Awaiting payment' : 'To fulfil';
      const hours = Math.max(24, Math.floor(Number(payload.hours_waiting) || 24));
      const subject = `[PRIORITY] ${number} overdue — ${label}`;
      const action = awaitingPayment
        ? "Please check whether the transfer has arrived before contacting the customer. If it has cleared, confirm payment so their order can move forward."
        : "Please check what's holding up dispatch, then pack and dispatch the order when ready. Add its tracking number when marking it shipped so the customer receives their update.";
      return {subject, html: shell(subject,
        `<h1 style="${styles.heading}">This order needs a check-in</h1>` + paragraph('Hi team,')
        + paragraph(`${order} has been in <strong>${label}</strong> for <strong>${hours} hours</strong>.`)
        + paragraph(`${esc(String(payload.customer_name || 'Customer'))} · ${cents(Number(payload.amount_cents) || 0)}`)
        + paragraph(action) + paragraph('Check the latest order status before taking action; another admin may already be working on it. Thanks for looking after it.')
        + button(`${SITE}/admin/orders/${encodeURIComponent(String(payload.order_id ?? ''))}`, 'Open this order')
        + `<p style="${styles.muted}">Sent to active admins. This reminder repeats every 24 hours while the order remains eligible in this queue.</p>`) };
    }
    case 'admin_daily_brief':
      if (typeof payload.subject !== 'string' || typeof payload.html !== 'string') throw new Error('Invalid daily brief');
      return {subject: payload.subject, html: payload.html};
    case 'cart_recovery_confirmation':
      return message('Your East Coast Labs cart — confirm your email to save it', 'Confirm within 24 hours to restore your cart and receive the reminders you requested.', 'Keep your cart handy',
        paragraph('You asked us for a link to your East Coast Labs cart. To confirm it\'s yours, open the link below within <strong>24 hours</strong> and select <strong>Confirm and restore</strong> on the page.')
        + paragraph('Once confirmed, you may receive up to three reminders—around 1 hour, 24 hours and 72 hours later—if you haven\'t completed your order and are still eligible. Your restore link expires seven days after your request.')
        + paragraph("This doesn't sign you up to our newsletter. If you didn't request a saved cart, you can ignore this email.")
        + button(recoveryLink(String(payload.recovery_request_id ?? '')), 'Confirm and restore my cart'));
    case 'subscription_confirmation': {
      const url = String(payload.confirmation_url ?? '');
      if (!url.startsWith(`${SITE}/subscribe/confirm?token=`)) throw new Error('Invalid confirmation link');
      return message('One quick step to join East Coast Labs updates', 'Confirm your email within 24 hours to receive our updates.', "We'd be glad to keep in touch",
        paragraph("Thanks for your interest in East Coast Labs. Before we send you our email updates, please confirm that this is the right address using the link below.")
        + paragraph('The link is valid for <strong>24 hours</strong>. You can unsubscribe from marketing emails whenever you like.')
        + paragraph("If you didn't request this, simply ignore the email. You don't need to do anything.")
        + button(url, 'Confirm my email'));
    }
    case 'payment_instructions': {
      const {instructions, payUrl} = await paymentBlock(payload);
      const amount = cents(Number(payload.amount_cents ?? 0));
      return message(`Thanks for your order — payment details for ${number}`, `Your items are reserved. Here's how to complete your payment of ${amount}.`, 'Thanks for choosing East Coast Labs',
        paragraph(`Thanks for placing an order with us. We've reserved your items under ${order}, and the next step is to complete your payment.`)
        + paragraph(`Your total is <strong>${amount}</strong>. Please use the exact amount and include <strong>${esc(String(payload.reference ?? number))}</strong> as your payment reference so we can match your transfer to your order.`)
        + (instructions ? instructionsTable(instructions) : paragraph(`Please contact us at ${support} before sending your payment so we can confirm the correct details.`))
        + paragraph("Once we've confirmed your payment, we'll send you an order confirmation and prepare your order for dispatch.")
        + paragraph(`Your reservation ends <strong>${esc(paymentDeadline(payload))}</strong>. After that, an unpaid order is released and its items become available again.`)
        + paragraph(`If you've already sent your payment, please don't send it again. If the payment details or recipient shown by your bank don't look right, stop and contact us at ${support} before transferring.`)
        + paragraph("We're happy to help you through it. Thanks again for choosing us.")
        + button(payUrl, 'View my payment details'));
    }
    case 'payment_reminder':
    case 'payment_expiring': {
      const {instructions, payUrl} = await paymentBlock(payload);
      const expiring = template === 'payment_expiring';
      const amount = cents(Number(payload.amount_cents ?? 0));
      return message(expiring ? `Your reservation for ${number} ends soon` : `A quick payment reminder for ${number}`,
        expiring ? `Your reservation ends ${paymentDeadline(payload)}. Here's what to do next.` : "We're still holding your items. If you've already paid, please don't pay again.",
        expiring ? 'A heads-up about your reservation' : 'A quick check-in about your order',
        paragraph(`We haven't confirmed payment for ${order} yet, so we're sending your details again in case they're useful.`)
        + paragraph(`Your reservation ends <strong>${esc(paymentDeadline(payload))}</strong>. ${expiring ? 'After the deadline, an unpaid order is cancelled and its items become available again.' : `If you'd like to go ahead, please transfer <strong>${amount}</strong> using the reference <strong>${esc(String(payload.reference ?? number))}</strong>.`}`)
        + (instructions ? instructionsTable(instructions) : paragraph(`Please contact us at ${support} before paying so we can confirm the correct details.`))
        + paragraph(`Already sent your payment? Please don't send it again. Transfers can take time to appear; email ${support} with your order number if you'd like us to check.`)
        + paragraph(expiring ? "If the payment arrives after the reservation ends, we'll need to check availability before confirming what happens next." : "And if you're unsure about something before paying, you're welcome to ask. We're here to help.")
        + button(payUrl, 'View my payment details'));
    }
    case 'payment_expired':
      return message(`An update on your order ${number}`, 'The payment window has ended and your reservation has been released.', 'Your reservation has ended',
        paragraph(`The payment window for ${order} has ended without a confirmed payment, so the order has been cancelled and the items released.`)
        + paragraph(`If you've already sent a transfer, please contact ${support} before placing another order or sending any more money. We'll check the payment and help you work out the next step.`)
        + paragraph("If you decided not to go ahead, there's nothing else you need to do. You're welcome to browse again whenever the time is right.")
        + paragraph('Thanks for considering East Coast Labs.') + button(`${SITE}/shop`, 'Browse the range'));
    case 'order_confirmation':
      return message(`You're all set — order ${number} is confirmed`, "Your payment is confirmed. We'll send your tracking details when your order ships.", "Payment confirmed. We'll take it from here.",
        paragraph(`Your payment for ${order} is confirmed—thank you.`)
        + paragraph("Your order is now ready for our team to prepare. There's nothing else you need to do; we'll send another email with your tracking number once it's shipped.")
        + orderPageNote + paragraph(`We appreciate you choosing East Coast Labs. If a question comes up before dispatch, email ${support} with your order number and we'll help.`));
    case 'order_shipped': {
      const tracking = payload.tracking_number ? String(payload.tracking_number) : null;
      return message(`On its way — your East Coast Labs order ${number}`, "Your order has shipped. You'll find your tracking details inside.", 'Your order is on its way',
        paragraph(`Your order ${order} has shipped from Australia in plain, discreet packaging.`)
        + (tracking ? paragraph(`Your tracking number: <strong style="font-family:monospace;">${esc(tracking)}</strong>`) : '')
        + orderPageNote + paragraph("Thanks for ordering with us. We hope everything reaches you safely, and we're here if you need a hand along the way.")
        + paragraph(`If you have a question about your delivery, email ${support} and include your order number so we can look into it.`));
    }
    case 'order_refunded': {
      const amount = typeof payload.amount_cents === 'number' ? cents(payload.amount_cents) : null;
      const helpUrl = `mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Refund for order ${number}`)}`;
      return message(`A refund update for order ${number}`, amount ? `We've recorded a refund of ${amount} against your order.` : "We've recorded a refund against your order.", 'An update on your refund',
        paragraph(`We've recorded a refund${amount ? ` of <strong>${amount}</strong>` : ''} against order ${order}.`)
        + paragraph(`If you'd like confirmation of the refund transfer, or have a question about the amount, please email ${support} with your order number so we can check the details for you.`)
        + paragraph('Thank you for giving us the opportunity to help with your order.') + button(helpUrl, 'Ask about my refund'));
    }
    case 'back_in_stock': {
      const name = String(payload.product_name ?? 'This product');
      const url = typeof payload.url === 'string' && /^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.url) ? payload.url : '/shop';
      return message(`Back in stock: ${name}`, 'The option you asked about is available again. Take a look at the current details.', 'A quick stock update for you',
        paragraph(`You asked us to let you know when <strong>${esc(name)}${payload.variant_label ? ` — ${esc(String(payload.variant_label))}` : ''}</strong> was available again, and it's now back in stock.`)
        + paragraph("If you're still looking for it, you can check the current availability, price and product information below. This notification doesn't reserve any stock for you.")
        + paragraph(`If you'd like to check a product detail before ordering, email ${support}. We're happy to help.`)
        + button(`${SITE}${url}`, `View ${name}`));
    }
    case 'abandoned_cart': {
      const items = Array.isArray(payload.cart) ? payload.cart as {name?:string;quantity?:number}[] : [];
      return message('Your East Coast Labs cart is here when you need it', 'Pick up where you left off, or get in touch if you have a question.', "Here's where you left off",
        paragraph("Here's the cart you asked us to save, so you don't have to find everything again.")
        + `<ul style="${styles.list}">${items.map(item => `<li>${esc(item.name ?? 'Item')} × ${Number(item.quantity ?? 1)}</li>`).join('')}</ul>`
        + paragraph("You can use the link below to review your items and continue when you're ready. Prices and availability are checked again at checkout; saving a cart doesn't reserve stock.")
        + paragraph(`If a question held you up, email ${support}. We're happy to help with product information or the ordering process.`)
        + button(recoveryLink(String(payload.recovery_request_id ?? '')), 'Return to my cart'));
    }
    case 'abandoned_cart_2':
      return message('Anything we can help with before you order?', 'Your saved cart is still available, along with a little ordering information.', 'A question before you decide?',
        paragraph("If you're still considering the items in your saved cart, you're welcome to get in touch before placing an order.")
        + paragraph(`We can help with product details, available documentation, pack options or how payment works. Email ${support} with the product name or your question, and we'll help you find the information you need.`)
        + `<ul style="${styles.list}"><li>Orders are prepared for dispatch from Australia after payment is confirmed.</li><li>Parcels use plain, discreet packaging.</li><li>Free standard shipping is available from ${cents(Math.round(settings.freeShippingThreshold * 100))}; your options and total are shown at checkout.</li></ul>`
        + paragraph("Your cart link is below if you'd like to take another look.")
        + button(recoveryLink(String(payload.recovery_request_id ?? '')), 'Review my saved cart'));
    case 'abandoned_cart_3':
      return message('One last reminder about your saved cart', 'This is our final reminder for this cart. Your link expires seven days after your request.', 'Your cart link, one last time',
        paragraph("We're sending your saved-cart link once more in case you'd still like it. This is the last reminder for this cart.")
        + paragraph('The link expires seven days after you requested it. You can review the current prices and availability at checkout before deciding whether to go ahead.')
        + paragraph("If now isn't the right time, no problem—there's nothing you need to do. Thanks for taking a look at East Coast Labs.")
        + button(recoveryLink(String(payload.recovery_request_id ?? '')), 'Return to my cart'));
    case 'welcome_1':
      return message("Welcome to East Coast Labs — here's 10% off your first order", 'A little introduction, your welcome code, and a way to reach us with questions.', "It's good to have you here",
        paragraph('Welcome to East Coast Labs, and thanks for joining us.')
        + paragraph("We're an Australian-owned supplier of research-use-only peptides. We want choosing a supplier to feel straightforward: clear product information, available documentation you can look through, and someone to contact when you have a question.")
        + paragraph("As a welcome, use <strong>WELCOME10</strong> for <strong>10% off your first order</strong>, subject to the offer's eligibility at checkout.")
        + `<div style="margin:16px 0;padding:16px;text-align:center;background:${EMAIL_COLORS.background};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;"><span style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:0.1em;">WELCOME10</span><div style="font-size:14px;margin-top:6px;">10% off your first order</div></div>`
        + paragraph(`Take a look around at your own pace. If you'd like help finding product information, checking which documents apply to an available batch, or understanding the ordering process, email ${support} before you order.`)
        + paragraph("We're happy to help.") + button(`${SITE}/shop`, 'Explore East Coast Labs'));
    case 'welcome_3':
      return message('A little help choosing your pack size', "Compare the available options—and ask us if something isn't clear.", 'Find the option that suits your order',
        paragraph("If you're still having a look through the East Coast Labs range, here's one useful place to start: the pack options on each product page.")
        + paragraph("You'll find the available quantities and per-vial pricing there, so you can compare them against your research requirements without guessing.")
        + paragraph("If you haven't placed your first order yet, <strong>WELCOME10</strong> is your first-order code. Any eligible discount and shipping benefits will be shown at checkout before you confirm.")
        + paragraph(`A question about a product, pack or document? Email ${support}. We'd much rather you ask than leave something unclear.`)
        + button(`${SITE}/shop`, 'Compare the available packs'));
    case 'arrival_checkin':
      return message(`Just checking in on order ${number}`, 'Has everything arrived safely? Let us know if you need a hand.', 'Did everything arrive OK?',
        paragraph(`Your order ${order} shipped recently, and we wanted to check how everything went.`)
        + paragraph(`Has it arrived safely, with everything you expected? If something is missing, damaged or hasn't arrived, email ${support} with your order number and a little detail about the issue.`)
        + paragraph("If everything is as it should be, there's nothing you need to do. We simply wanted to say thank you for ordering with us—and make sure you know where to find us if you need help.")
        + button(`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Help with order ${number}`)}`, 'Get help with my order'));
    case 'post_purchase_review': {
      const reviewUrl = `${SITE}/leave-a-review?token=${createOrderAccessToken(String(payload.order_id ?? ''), 'review')}`;
      const bought = productNames(payload);
      return message(`Did everything arrive OK? — order ${number}`, "We'd love to hear how your order went—and help if anything needs attention.", 'Did everything arrive OK?',
        paragraph(`We're checking in on your East Coast Labs order ${order}${bought ? ` — ${bought}` : ''}. Has everything arrived safely?`)
        + paragraph(`If anything is missing, damaged or still on its way, please email ${support} or contact us privately on <a href="${EMAIL_TELEGRAM}" style="color:${EMAIL_COLORS.accent};">Telegram</a>. Let us know what's happened so we can help.`)
        + paragraph("We'd also really appreciate an honest review of your experience. How was the ordering process? Was everything packaged well? Is there something we could do better?")
        + paragraph('A few words are plenty. Whether your experience was great or there\'s room for improvement, your feedback matters to us—and helps other customers know what to expect.')
        + starRow(reviewUrl) + button(reviewUrl, 'Leave a review')
        + paragraph('Thanks for choosing East Coast Labs and taking a moment to share your thoughts.'));
    }
    case 'post_purchase_review_reminder': {
      // Historical preview only: the delivery policy continues to retire this template.
      const reviewUrl = `${SITE}/leave-a-review?token=${createOrderAccessToken(String(payload.order_id ?? ''), 'review')}`;
      const bought = productNames(payload);
      return message('One last invitation to share your experience', "If you'd like to leave a review, we'd appreciate hearing how your order went.", 'Your feedback is welcome',
        paragraph(`If you've received ${bought ? `your order of ${bought}` : 'your order'} and would like to share your experience, we'd appreciate an honest review of ordering from East Coast Labs.`)
        + paragraph("A sentence or two is plenty. You're welcome to tell us what worked well and anything we could improve.")
        + paragraph(`If your order hasn't arrived or something needs attention, please email ${support} so we can help. You don't need to leave a review to get support.`)
        + starRow(reviewUrl) + button(reviewUrl, 'Share my experience') + paragraph('This is our final review reminder for this order. Thanks for your time.'));
    }
    case 'review_thank_you':
      return message('Thanks for taking the time to leave a review', "Your feedback helps us understand what we're doing well and what we can improve.", 'We appreciate your feedback',
        paragraph('Thank you for taking a moment to share your experience with East Coast Labs. We know it takes time, and we appreciate it.')
        + paragraph("Your review is with our team for moderation. Hearing what went well—and what didn't—helps us improve the way we look after our customers.")
        + paragraph(`If there's still something unresolved with your order, please email ${support}. A review is useful feedback, but we'd also like the opportunity to help you directly.`)
        + button(`mailto:${settings.supportEmail}`, 'Contact our team'));
    case 'replenishment': {
      const items = Array.isArray(payload.items) ? payload.items as {name?:string;qty?:number;url?:string}[] : [];
      const lines = items.map(item => {
        const url = typeof item.url === 'string' && /^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.url) ? `${SITE}${item.url}` : null;
        return `<li style="margin:8px 0;">${esc(String(item.name ?? 'Item'))} × ${Number.isInteger(item.qty) ? item.qty : 1}${url ? ` — <a href="${url}" style="color:${EMAIL_COLORS.accent};">View this product</a>` : ''}</li>`;
      }).join('');
      return message('A helpful reference for your next research order', "Your previous items, together in one place, if you're planning another order.", 'Planning another order?',
        paragraph("If you're planning another research order, we've brought together the items from your previous order as a handy reference.")
        + (lines ? `<ul style="${styles.list}">${lines}</ul>` : '')
        + paragraph('You can check current availability and pack options below, and choose what fits your requirements now. This is simply a reminder—not an assumption that you need more.')
        + paragraph(`If you'd like help finding an item or checking a product detail, email ${support}.`)
        + button(`${SITE}/shop`, 'Check current availability'));
    }
    case 'winback_60':
      return message('A hello from East Coast Labs', "If another research order is on your list, here's where to find the current range.", 'A quick hello from our team',
        paragraph("It's been a little while since your last order, so we wanted to say hello.")
        + paragraph(`If you're planning another research order, you can browse the current range and compare the available packs below. If you have a question before deciding, email ${support}—we're happy to help.`)
        + paragraph("And if you're not looking for anything right now, that's fine too. Thank you for choosing East Coast Labs previously.")
        + button(`${SITE}/shop`, 'Browse the current range'));
    case 'winback_90':
      return message('A thank-you for returning — 10% off your next order', "Use RESTOCK10 if you're ready to order again. Eligibility is confirmed at checkout.", 'A little thank-you for your next order',
        paragraph('Thanks for being an East Coast Labs customer.')
        + paragraph("If you're ready to place another order, use <strong>RESTOCK10</strong> for <strong>10% off your next order</strong>, subject to the offer's eligibility at checkout.")
        + paragraph(`You can check the current range, pack options and prices below. If you'd like help with a product detail or ordering question first, email ${support}.`)
        + paragraph("We'd be glad to help with your next order, whenever it suits your research requirements.")
        + button(`${SITE}/shop`, 'Explore the range'));
    case 'second_purchase_nudge':
      return message('Thanks again for your first East Coast Labs order', "Whether you have a question about that order or you're planning another, we're here to help.", 'Thanks for giving us a try',
        paragraph('We wanted to say thank you again for choosing East Coast Labs for your first order.')
        + paragraph(`If anything about that experience needs attention, please let us know at ${support}. We'd like the chance to help.`)
        + paragraph("And if you're planning another research order, you can find the current range, pack options and pricing below. There's no need to order again until it suits your requirements.")
        + button(`${SITE}/shop`, 'Browse the current range'));
    default:
      return message('An update from East Coast Labs', 'Get in touch if you have a question.', 'A note from our team', paragraph(`If you have a question about your order or our range, contact us at ${support}. We're happy to help.`));
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
