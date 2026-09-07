// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
afterEach(cleanup);
import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({open:false,close:vi.fn()}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({cartOpen:m.open,closeCart:m.close})}));
vi.mock('@/components/CartContents',()=>({default:()=> <a href='/checkout'>Checkout</a>}));
import CartDrawer from '@/components/CartDrawer';
it('unmounts all closed cart controls',()=>{m.open=false;render(<CartDrawer/>);expect(screen.queryByRole('link',{name:'Checkout',hidden:true})).toBeNull();});
it('focuses and traps the open cart and restores the trigger on close',()=>{const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();m.open=true;const ui=render(<CartDrawer/>);expect(screen.getByRole('button',{name:'Close cart'})).toHaveFocus();screen.getByRole('link').focus();fireEvent.keyDown(document,{key:'Tab'});expect(screen.getByRole('button',{name:'Close cart'})).toHaveFocus();m.open=false;ui.rerender(<CartDrawer/>);expect(trigger).toHaveFocus();trigger.remove();});
