export function safeCustomerReturnPath(value: unknown): string {
  return typeof value === 'string' && /^\/orders\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value : '/account/orders';
}
