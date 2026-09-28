"use client";

import PurchaseIcon from './PurchaseIcon';
import { useCart } from '@/lib/cart-context';
import { shippingSummary } from '@/lib/shipping-policy';
import PaymentSteps from './PaymentSteps';

export default function PurchaseReassurance() {
  const { shipping, paymentLabels } = useCart();
  return <div className="space-y-3 border-t border-line pt-3 text-xs text-muted">
    {shipping && <a href="/shipping" className="flex items-start gap-2 hover:text-fg">
      <PurchaseIcon name="shipping" className="mt-0.5" />
      <span>{shipping.map(rule => <span key={rule.method} className="block">{shippingSummary(rule)}</span>)}
        <span className="mt-1 block">Thresholds apply after discounts. Transit starts after dispatch.</span>
      </span>
    </a>}
    <p className="flex items-start gap-2"><PurchaseIcon name="payment" />
      <span>{paymentLabels?.length === 0 ? 'Payments currently unavailable' : `Pay by ${paymentLabels?.join(' or ') || 'bank transfer'}. Transfer details follow your order.`}</span>
    </p>
    {paymentLabels?.length !== 0 && <PaymentSteps compact />}
    <a href="/returns" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-fg">Returns and order support</a>
  </div>;
}
