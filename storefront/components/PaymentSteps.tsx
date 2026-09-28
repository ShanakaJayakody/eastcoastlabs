export default function PaymentSteps({ compact = false }: { compact?: boolean }) {
  return <ol aria-label="How payment works" className={`grid gap-2 text-xs text-fg-2 ${compact ? 'grid-cols-3' : ''}`}>
    <li><span className="font-semibold">1. Order</span>{!compact && ' — receive your transfer details.'}</li>
    <li><span className="font-semibold">2. Transfer</span>{!compact && ' — use the exact amount and order reference.'}</li>
    <li><span className="font-semibold">3. Payment confirmed</span>{!compact && ' — we confirm receipt, then prepare your order.'}</li>
  </ol>;
}
