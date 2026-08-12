import type { EmailTemplate } from "@/lib/admin/email";

/**
 * Sample payloads for the admin template previewer. These mirror the shape each
 * sweep/trigger actually sends, so a preview that looks right is evidence the
 * live email will too.
 */

const SAMPLE_UNSUB = "https://eastcoastlabs.com.au/api/unsubscribe?t=sample-preview-token";

/** Templates that carry an unsubscribe footer (marketing, not transactional). */
export const MARKETING_TEMPLATES: EmailTemplate[] = [
  "abandoned_cart",
  "abandoned_cart_2",
  "abandoned_cart_3",
  "back_in_stock",
  "welcome_1",
  "welcome_3",
  "post_purchase_review",
  "replenishment",
  "winback_60",
  "winback_90",
  "second_purchase_nudge",
];

export interface TemplateGroup {
  label: string;
  templates: { id: EmailTemplate; name: string; trigger: string }[];
}

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    label: "Transactional",
    templates: [
      { id: "order_confirmation", name: "Order confirmation", trigger: "Payment marked received" },
      { id: "order_shipped", name: "Order shipped", trigger: "Admin marks order shipped" },
      { id: "order_refunded", name: "Order refunded", trigger: "Refund issued in admin" },
      { id: "payment_instructions", name: "Payment instructions", trigger: "Order placed (unpaid)" },
      { id: "payment_reminder", name: "Payment reminder", trigger: "Unpaid at +4h, then +24h" },
      { id: "payment_expired", name: "Payment expired", trigger: "Hold window elapsed" },
    ],
  },
  {
    label: "Cart recovery",
    templates: [
      { id: "abandoned_cart", name: "Abandoned cart 1", trigger: "Cart idle +1h (no discount)" },
      { id: "abandoned_cart_2", name: "Abandoned cart 2", trigger: "Cart idle +24h" },
      { id: "abandoned_cart_3", name: "Abandoned cart 3", trigger: "Cart idle +72h (last call)" },
    ],
  },
  {
    label: "Welcome series",
    templates: [
      { id: "welcome_1", name: "Welcome 1 — code", trigger: "Subscribed (immediate)" },
      { id: "welcome_3", name: "Welcome 3 — pack pricing", trigger: "Subscribed +4 days" },
    ],
  },
  {
    label: "Post-purchase & retention",
    templates: [
      { id: "post_purchase_review", name: "Review request", trigger: "Shipped +14 days" },
      { id: "replenishment", name: "Replenishment", trigger: "Shipped +3/10/22wk by pack size" },
      { id: "second_purchase_nudge", name: "Second-purchase nudge", trigger: "1 order, +30 days" },
      { id: "winback_60", name: "Winback 60d", trigger: "60 days since last order" },
      { id: "winback_90", name: "Winback 90d", trigger: "90 days since last order" },
      { id: "back_in_stock", name: "Back in stock", trigger: "Waitlisted variant restocked" },
    ],
  },
];

export const ALL_TEMPLATES = TEMPLATE_GROUPS.flatMap((g) => g.templates);

const SAMPLE_CART = [
  { name: "BPC-157 10mg", quantity: 3 },
  { name: "Bacteriostatic Water 10ml", quantity: 1 },
];

export function samplePayload(template: EmailTemplate): Record<string, unknown> {
  const base: Record<string, unknown> = MARKETING_TEMPLATES.includes(template)
    ? { unsubscribe_url: SAMPLE_UNSUB }
    : {};

  switch (template) {
    case "order_confirmation":
    case "payment_expired":
      return { ...base, order_number: "ECL-1042" };
    case "order_shipped":
      return { ...base, order_number: "ECL-1042", tracking_number: "33ABC1234567890" };
    case "order_refunded":
      return { ...base, order_number: "ECL-1042", amount_cents: 24900 };
    case "payment_instructions":
      return {
        ...base,
        order_number: "ECL-1042",
        order_id: "00000000-0000-0000-0000-000000000000",
        payment_method: "payid",
        reference: "ECL1042",
        amount_cents: 24900,
      };
    case "payment_reminder":
      return {
        ...base,
        order_number: "ECL-1042",
        order_id: "00000000-0000-0000-0000-000000000000",
        payment_method: "payid",
        reference: "ECL1042",
        amount_cents: 24900,
        hours_left: 18,
      };
    case "abandoned_cart":
    case "abandoned_cart_2":
    case "abandoned_cart_3":
      return { ...base, cart: SAMPLE_CART, subtotal_cents: 24900 };
    case "post_purchase_review":
      return {
        ...base,
        order_number: "ECL-1042",
        review_url: "https://eastcoastlabs.com.au/leave-a-review?order=ECL-1042",
      };
    case "replenishment":
      return {
        ...base,
        pack_size: 3,
        items: [{ name: "BPC-157 10mg", qty: 3 }],
      };
    case "back_in_stock":
      return {
        ...base,
        product_name: "TB-500 10mg",
        product_slug: "tb-500",
        variant_label: "3-pack",
        url: "/product/tb-500",
      };
    default:
      return base;
  }
}
