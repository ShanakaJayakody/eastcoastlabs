// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
const gate=vi.hoisted(()=>{
 let resolve!:()=>void;
 return {loaded:vi.fn(),ready:new Promise<void>(r=>{resolve=r;}),finish:()=>resolve()};
});
vi.mock('@/components/admin/RichTextEditor',async()=>{
 gate.loaded();await gate.ready;
 return {default:({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string})=><textarea data-testid="rich" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}/>};
});
import DescriptionEditor from '@/components/admin/DescriptionEditor';
function Harness(){const [value,setValue]=useState('<p>Saved</p>');return <DescriptionEditor value={value} onChange={setValue} label="Full description"/>;}
it('imports only on editing intent and keeps the typing surface stable when the chunk arrives',async()=>{
 render(<Harness/>);
 expect(gate.loaded).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Edit description'}));
 expect(screen.getByRole('status').textContent).toContain('Loading formatting tools');
 const source=screen.getByRole('textbox',{name:'Full description'});
 expect(document.activeElement).toBe(source);
 fireEvent.change(source,{target:{value:'<p>Typed during loading</p>'}});
 await act(async()=>{gate.finish();await gate.ready;});
 expect(gate.loaded).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('textbox',{name:'Full description'})).toBe(source);
 expect(document.activeElement).toBe(source);
 expect(source).toHaveProperty('value','<p>Typed during loading</p>');
 fireEvent.click(screen.getByRole('button',{name:'Use formatting tools'}));
 expect(screen.getByTestId('rich')).toHaveProperty('value','<p>Typed during loading</p>');
});
