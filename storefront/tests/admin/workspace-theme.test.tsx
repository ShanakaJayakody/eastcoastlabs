// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {AdminThemeProvider,useAdminTheme,readAdminTheme} from '@/components/admin/AdminThemeProvider';
afterEach(cleanup);
function Control(){const {theme,setTheme}=useAdminTheme();return <button onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme}</button>}
it('validates the server cookie and defaults to light',()=>{
 window.history.replaceState({},'', '/admin');
 expect(readAdminTheme('dark')).toBe('dark');expect(readAdminTheme('invalid')).toBe('light');
 render(<AdminThemeProvider><Control/></AdminThemeProvider>);
 fireEvent.click(screen.getByText('light'));
 expect(screen.getByText('dark')).toBeTruthy();
 expect(document.cookie).toContain('ecl-admin-theme=dark');
});
it('renders a saved dark preference on first render',()=>{
 render(<AdminThemeProvider initialTheme="dark"><Control/></AdminThemeProvider>);
 expect(screen.getByText('dark')).toBeTruthy();
});
