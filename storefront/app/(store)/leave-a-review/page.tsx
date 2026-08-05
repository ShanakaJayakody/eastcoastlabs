import type { Metadata } from "next";
import ReviewSubmitForm from "@/components/ReviewSubmitForm";

export const metadata: Metadata = {
  title: "Leave a review",
  description:
    "Review your East Coast Labs order. Verified buyers only — we publish honest feedback regardless of rating.",
};

export default async function LeaveReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; email?: string }>;
}) {
  const { order, email } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Verified reviews</p>
      <h1 className="mt-2 text-2xl font-bold text-fg">Leave a review</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your order details so we can verify your purchase. We never edit or remove reviews based on
        rating — honest feedback only.
      </p>
      <div className="mt-8">
        <ReviewSubmitForm initialOrder={order ?? ""} initialEmail={email ?? ""} />
      </div>
    </div>
  );
}
