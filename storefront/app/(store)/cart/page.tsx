import type { Metadata } from "next";
import CartContents from "@/components/CartContents";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your research peptide order and check out securely on eastcoastlabs.com.au.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-fg">Your cart</h1>
      <div className="overflow-hidden rounded-2xl border border-line bg-ink-2">
        <CartContents />
      </div>
    </div>
  );
}
