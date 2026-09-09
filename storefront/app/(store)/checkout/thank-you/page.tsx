import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyOrderAccessToken } from "@/lib/order-access";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ThankYouPage({ searchParams }: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { token } = await searchParams;
  const orderId = verifyOrderAccessToken(token, "payment");
  if (orderId) redirect(`/pay/${orderId}?token=${encodeURIComponent(token!)}`);
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-fg">Open your secure order link</h1>
      <p className="mt-3 text-sm text-muted">
        Use the payment link in your latest order email to see your order details.
        If your link has expired, contact us with your order reference for help.
      </p>
      <Link href="/contact" className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
        Contact us
      </Link>
    </div>
  );
}
