import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../app/globals.css';
import '../../app/(store)/editorial.css';
import { CartProvider, useCart } from '../../lib/cart-context';
import CartContents from '../../components/CartContents';

function CartFixture() {
  const { clear, addLine } = useCart();
  function load(amount: number) {
    clear();
    addLine({ key: 'reward-preview', productId: 900001, name: 'Synthetic research item', slug: 'synthetic-compound', variantLabel: '1 vial', unitPrice: amount });
  }
  return <>
    <div className="flex flex-wrap gap-2 p-4">
      {[99.99, 100, 149.99, 150, 199.99, 200].map(amount => <button key={amount} className="rounded border border-line p-2" onClick={() => load(amount)}>Cart ${amount}</button>)}
    </div>
    <CartContents />
  </>;
}

function Preview() {
  const [width, setWidth] = useState(390);
  const [giftAvailable, setGiftAvailable] = useState(true);
  const [expressEnabled, setExpressEnabled] = useState(true);
  return <div className="ecl-store min-h-screen p-4">
    <div className="mb-4 flex flex-wrap gap-4 text-sm">
      <label>Preview width <select value={width} onChange={event => setWidth(Number(event.target.value))}><option>320</option><option>390</option><option>640</option></select></label>
      <label><input type="checkbox" checked={giftAvailable} onChange={event => setGiftAvailable(event.target.checked)} /> Gift in stock</label>
      <label><input type="checkbox" checked={expressEnabled} onChange={event => setExpressEnabled(event.target.checked)} /> Express enabled</label>
    </div>
    <main style={{ width, maxWidth: '100%' }} className="mx-auto border border-line bg-ink">
      <h1 className="p-4 text-xl">Cart rewards — synthetic preview</h1>
      <CartProvider thresholds={{freeShipping:100, gift:150, express:expressEnabled ? 200 : undefined}} stock={{'bacteriostatic-water': giftAvailable ? 5 : 0}}>
        <CartFixture />
      </CartProvider>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
