// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import AdminWriteButton from '@/components/admin/AdminWriteButton';
import {AdminReadOnlyContext} from '@/components/admin/AdminReadOnlyContext';
afterEach(cleanup);
it('disables writes natively but leaves ordinary controls usable',()=>{
 const write=vi.fn(),view=vi.fn();
 render(<AdminReadOnlyContext.Provider value={true}><AdminWriteButton onClick={write}>Save changes</AdminWriteButton><button onClick={view}>View figures</button></AdminReadOnlyContext.Provider>);
 expect((screen.getByText('Save changes') as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByText('Save changes'));expect(write).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('View figures'));expect(view).toHaveBeenCalled();
});
it('retains ordinary production button behavior',()=>{
 const write=vi.fn();render(<AdminWriteButton onClick={write}>Save changes</AdminWriteButton>);
 fireEvent.click(screen.getByText('Save changes'));expect(write).toHaveBeenCalledTimes(1);
});
