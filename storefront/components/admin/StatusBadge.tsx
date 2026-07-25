import Badge, { type BadgeTone } from "./Badge";

/** One consistent colour semantic for order status across the whole admin. */
const TONE: Record<string, BadgeTone> = {
  pending: "warn",
  paid: "info",
  processing: "info",
  shipped: "success",
  completed: "success",
  cancelled: "neutral",
  refunded: "danger",
};

export default function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{status}</Badge>;
}
