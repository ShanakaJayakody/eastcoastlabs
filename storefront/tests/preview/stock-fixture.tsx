import { useState } from "react";
import StockDrawer, { type StockTarget } from "@/components/admin/StockDrawer";
import StockHistory from "@/components/admin/StockHistory";
import type { MovementRow } from "@/lib/admin/products";

const receipts: MovementRow[] = [
  { id: "r1", qty: 80, reason: "received", actor_email: "alex@example.test", actor_name: "Alex Chen", note: "Batch ECL-0917 · Supplier delivery checked and counted.", created_at: "2026-09-17T01:30:00Z", reversed: false },
  { id: "r2", qty: 35, reason: "received", actor_email: "jordan@example.test", actor_name: "Jordan Lee", note: "Additional delivery — batch ECL-0915.", created_at: "2026-09-15T04:15:00Z", reversed: false },
  { id: "r3", qty: 20, reason: "received", actor_email: "taylor@example.test", actor_name: "Taylor Singh", note: "Duplicate receipt; reversed after review.", created_at: "2026-09-14T02:10:00Z", reversed: true },
];
const target: StockTarget = { slug: "stock-fixture", name: "Research compound · 10 mg", poolId: "stock-preview", vialsOnHand: 94, unitCostCents: 1850,
  variants: [1,3,6].map(pack => ({ id: `v${pack}`, sku: `STOCK-${pack}`, pack_size: pack, label: pack === 1 ? "1 vial" : `${pack}-pack`, price_cents: 4500 * pack,
    compare_at_cents: null, low_stock_threshold: 5, on_hand: 94, reserved: 0, available: Math.floor(94 / pack), active: true })) };

export default function StockFixture() {
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).get("open") === "1");
  return <div className="admin-theme">
    <h1 className="text-2xl font-semibold">Inventory · Research compound</h1>
    <button className="my-4 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink" onClick={() => setOpen(true)}>Manage stock</button>
    <StockHistory movements={receipts} productName={target.name}/>
    <StockDrawer target={open ? target : null} adminName="Taylor Singh" onClose={() => setOpen(false)} initialMovements={receipts}/>
  </div>;
}
