'use client';
export default function CustomerError({ reset }: { reset: () => void }) {
  return <section className="co-card co-signin"><h1>We couldn’t load this page</h1><p>Your order is safe. Please try again, or contact us if you need help.</p><button className="co-button" onClick={reset}>Try again</button></section>;
}
