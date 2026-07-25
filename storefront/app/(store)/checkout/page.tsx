import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-fg">Checkout</h1>
      <p className="mt-1 text-sm text-muted">
        Research use only — not for human or animal consumption.
      </p>
      <CheckoutForm />
    </div>
  );
}
