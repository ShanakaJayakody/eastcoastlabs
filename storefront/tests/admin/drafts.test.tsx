// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
afterEach(()=>{cleanup();sessionStorage.clear();});
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/admin/(dashboard)/products/actions',()=>({saveProductAll:vi.fn(),duplicateProductAction:vi.fn(),saveUnitCost:vi.fn(),addTiersAction:vi.fn()}));
vi.mock('@/components/admin/RichTextEditor',()=>({default:({value,onChange,label}:{value:string;onChange:(v:string)=>void;label?:string})=><textarea data-testid={`rich-${label}`} aria-label={label} value={value} onChange={e=>onChange(e.target.value)} />}));
vi.mock('@/components/admin/ProductImages',()=>({default:()=>null}));
vi.mock('@/components/admin/StockDrawer',()=>({default:()=>null}));
import ProductEditor from '@/components/admin/ProductEditor';
import type {ProductDetail} from '@/lib/admin/products';
it('dirty description survives refreshed media and stock props',async()=>{
 const product={id:'p',slug:'test',name:'Test',status:'draft',unit_cost_cents:null,variants:[],images:[],description:'Saved',short_description:'Short',seo_title:null,seo_description:null,edit_version:0} as unknown as ProductDetail;
 const props={product,movements:[],waitlist:0,prev:null,next:null};
 const {rerender}=render(<ProductEditor {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Edit description'}));
 fireEvent.change(await screen.findByTestId('rich-Full description'),{target:{value:'My unsaved description'}});
 rerender(<ProductEditor {...props} product={{...product,images:[{src:'/new.png'}],totalOnHand:40}}/>);
 expect(screen.getByDisplayValue('My unsaved description')).toBeTruthy();
});
it('restores the unsaved draft after leaving and returning with browser back',async()=>{
 const product={id:'back-test',slug:'back-test',name:'Test',status:'draft',unit_cost_cents:null,variants:[],images:[],description:'Before back',short_description:'Short',seo_title:null,seo_description:null,edit_version:0} as unknown as ProductDetail;
 const props={product,movements:[],waitlist:0,prev:null,next:null};
 const first=render(<ProductEditor {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Edit description'}));
 fireEvent.change(await screen.findByTestId('rich-Full description'),{target:{value:'Keep across back'}});
 first.unmount();
 render(<ProductEditor {...props}/>);
 expect(screen.getByDisplayValue('Keep across back')).toBeTruthy();
});

it('defers formatting controls until explicit description editing',()=>{
 const product={id:'lazy-test',slug:'lazy-test',name:'Test',status:'draft',unit_cost_cents:null,variants:[],images:[],description:'Saved description',short_description:'Short',seo_title:null,seo_description:null,edit_version:7} as unknown as ProductDetail;
 render(<ProductEditor product={product} movements={[]} waitlist={0} prev={null} next={null}/>);
 expect(screen.getByDisplayValue('Saved description')).toHaveProperty('readOnly',true);
 expect(screen.getByRole('button',{name:'Edit description'})).toBeTruthy();
 expect(screen.queryByRole('textbox',{name:'Full description'})).toBeNull();
});
