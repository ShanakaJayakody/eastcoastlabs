'use client';

import dynamic from 'next/dynamic';
import {useUI} from '@/lib/ui-context';

const CartDrawer = dynamic(() => import('@/components/CartDrawer'), {ssr: false});

/** Cart contents are only needed after a shopper opens the bag. */
export default function NavyCartDrawer() {
  const {cartOpen} = useUI();
  return cartOpen ? <CartDrawer /> : null;
}
