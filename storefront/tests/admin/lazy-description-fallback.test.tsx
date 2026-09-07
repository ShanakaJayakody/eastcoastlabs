// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
vi.mock('@/components/admin/RichTextEditor',async()=>{throw new Error('Chunk unavailable');});
import DescriptionEditor from '@/components/admin/DescriptionEditor';
function Harness(){const [value,setValue]=useState('Saved');return <DescriptionEditor value={value} onChange={setValue} label="Full description"/>;}
it('retains a usable controlled textarea after the formatting chunk fails',async()=>{
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Edit description'}));
 expect(await screen.findByRole('button',{name:'Retry formatting tools'})).toBeTruthy();
 const source=screen.getByRole('textbox',{name:'Full description'});
 fireEvent.change(source,{target:{value:'Still editable'}});
 expect(source).toHaveProperty('value','Still editable');
 expect(screen.getByRole('status').textContent).toContain('could not load');
});
