// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import AdminShell from '@/components/admin/AdminShell';
vi.mock('next/navigation',()=>({usePathname:()=>'/admin'}));
vi.mock('@/lib/admin/auth-actions',()=>({signOut:vi.fn()}));
vi.mock('@/app/admin/search-actions',()=>({searchAdmin:vi.fn()}));
afterEach(cleanup);
it('provides a themed read-only shell and restores focus from the mobile dialog',()=>{
 render(<AdminShell email="admin@example.test" readOnly><p>Dashboard</p></AdminShell>);
 expect(screen.getByText('Preview · real store data · read-only')).toBeTruthy();
 const open=screen.getByLabelText('Open menu');open.focus();fireEvent.click(open);
 const dialog=screen.getByRole('dialog',{name:'Navigation'});
 expect(dialog.contains(document.activeElement)).toBe(true);
 fireEvent.keyDown(document,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(open);
 fireEvent.click(screen.getByLabelText('Switch to dark mode'));
 expect(screen.getByText('Dashboard').closest('[data-admin-theme]')?.getAttribute('data-admin-theme')).toBe('dark');
});
