export interface OrderShippingMethod {
  id: "express" | "standard";
  label: "EXPRESS SHIPPING" | "STANDARD SHIPPING";
}

/** Checkout defaults to standard, so legacy orders without a snapshot do too. */
export function orderShippingMethod(
  address: Record<string, string | null> | null,
): OrderShippingMethod {
  return address?.shipping_method === "express"
    ? { id: "express", label: "EXPRESS SHIPPING" }
    : { id: "standard", label: "STANDARD SHIPPING" };
}
