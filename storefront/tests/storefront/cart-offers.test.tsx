// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CartProvider, type CartLine } from '@/lib/cart-context';
import CartContents from '@/components/CartContents';
import CartUpsell from '@/components/CartUpsell';
import CheckoutBump from '@/components/CheckoutBump';

const stock = {'bacteriostatic-water':20,'reconstitution-kit':10,'insulin-syringes':20,'alcohol-swabs':20};
const paid:CartLine = {key:'bpc:single',productId:1,slug:'bpc-157',name:'BPC',variantLabel:'1 vial',unitPrice:60,quantity:1};
const kit:CartLine = {key:'acc:reconstitution-kit',productId:2,slug:'reconstitution-kit',name:'Kit',variantLabel:'1 kit',unitPrice:40,quantity:1};
beforeEach(()=>localStorage.clear());
afterEach(cleanup);

it('does not create a gift in an empty cart when the gift threshold is zero',()=>{
  render(<CartProvider thresholds={{freeShipping:0,gift:0}} stock={stock}><CartContents/></CartProvider>);
  expect(screen.getByText('Your cart is empty.')).toBeVisible();
  expect(screen.queryByRole('button',{name:'Checkout →'})).not.toBeInTheDocument();
});

it('removes the automatic gift when the last paid item is removed',()=>{
  localStorage.setItem('ecl_cart_v1',JSON.stringify([paid]));
  render(<CartProvider thresholds={{freeShipping:0,gift:0}} stock={stock}><CartContents/></CartProvider>);
  expect(screen.getByText('Included free')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Remove BPC'}));
  expect(screen.getByText('Your cart is empty.')).toBeVisible();
});

it('does not suggest kit components already included in the cart',()=>{
  localStorage.setItem('ecl_cart_v1',JSON.stringify([paid,kit]));
  render(<CartProvider stock={stock}><CartUpsell/><CheckoutBump products={[
    {id:3,slug:'bacteriostatic-water',name:'Water',price:20},
    {id:4,slug:'insulin-syringes',name:'Syringes',price:9},
    {id:5,slug:'alcohol-swabs',name:'Swabs',price:10},
  ]}/></CartProvider>);
  expect(screen.queryAllByRole('button',{name:/Add/})).toHaveLength(0);
});

it('does not promote a kit that duplicates water already included as a gift',()=>{
  localStorage.setItem('ecl_cart_v1',JSON.stringify([paid,{...paid,key:'gift:bac-water',slug:'bacteriostatic-water',name:'Water',unitPrice:0}]));
  render(<CartProvider stock={stock}><CartUpsell/></CartProvider>);
  expect(screen.queryByRole('button',{name:'Add Reconstitution Starter Kit'})).not.toBeInTheDocument();
});

it('does not suggest an out-of-stock checkout accessory',()=>{
  localStorage.setItem('ecl_cart_v1',JSON.stringify([paid]));
  render(<CartProvider stock={{'bacteriostatic-water':0}}><CheckoutBump products={[{id:3,slug:'bacteriostatic-water',name:'Water',price:20}]}/></CartProvider>);
  expect(screen.queryByRole('button',{name:/Add/})).not.toBeInTheDocument();
});
