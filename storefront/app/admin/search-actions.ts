"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { formatAud } from "@/lib/format";

export interface SearchResultItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  href: string;
}

const cents = (c: number) => formatAud(c / 100);

/** ⌘K data search — orders, products, customers. Gated by requireAdmin like any
 *  other admin data read; the palette calls this via a debounced client effect. */
export async function searchAdmin(query: string): Promise<SearchResultItem[]> {
  await requireAdmin();
  // Strip characters that would otherwise break PostgREST's .or() filter grammar
  // (commas separate conditions, parens group them).
  const q = query.trim().replace(/[,()]/g, "");
  if (q.length < 2) return [];
  const db = adminDb();
  const like = `%${q}%`;

  const [orders, products, customers] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, customer_email, customer_name, total_cents")
      .or(`order_number.ilike.${like},customer_email.ilike.${like},customer_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("products")
      .select("slug, name, sku")
      .or(`name.ilike.${like},sku.ilike.${like}`)
      .limit(5),
    db.from("customers").select("email, name").ilike("email", like).limit(5),
  ]);

  const items: SearchResultItem[] = [];

  for (const o of orders.data ?? []) {
    items.push({
      id: `order:${o.id}`,
      label: `${o.order_number} — ${o.customer_name || o.customer_email}`,
      hint: cents(o.total_cents as number),
      group: "Orders",
      href: `/admin/orders/${o.id}`,
    });
  }
  for (const p of products.data ?? []) {
    items.push({
      id: `product:${p.slug}`,
      label: p.name as string,
      hint: p.sku as string,
      group: "Products",
      href: `/admin/products/${p.slug}`,
    });
  }
  for (const c of customers.data ?? []) {
    items.push({
      id: `customer:${c.email}`,
      label: (c.name as string) || (c.email as string),
      hint: c.email as string,
      group: "Customers",
      href: `/admin/customers/${encodeURIComponent(c.email as string)}`,
    });
  }

  return items;
}
