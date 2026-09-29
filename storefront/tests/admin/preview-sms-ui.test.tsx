// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import AdminSmsSettings from '@/components/admin/AdminSmsSettings';
import {AdminReadOnlyContext} from '@/components/admin/AdminReadOnlyContext';
vi.mock('@/app/admin/(dashboard)/settings/admin-sms-actions',()=>({saveAdminSmsSettings:vi.fn(),previewAdminSms:vi.fn(),testAdminSms:vi.fn()}));
afterEach(cleanup);
it('disables SMS settings and provider calls in the read-only shell',()=>{
  render(<AdminReadOnlyContext.Provider value={true}><AdminSmsSettings settings={{enabled:true,start_hour:8}} history={[]} serverEnabled /></AdminReadOnlyContext.Provider>);
  expect((screen.getByRole('button',{name:'Save SMS settings'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'Refresh live preview'}) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps SMS controls enabled in the production shell',()=>{
  render(<AdminReadOnlyContext.Provider value={false}><AdminSmsSettings settings={{enabled:true,start_hour:8}} history={[]} serverEnabled /></AdminReadOnlyContext.Provider>);
  expect((screen.getByRole('button',{name:'Save SMS settings'}) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button',{name:'Refresh live preview'}) as HTMLButtonElement).disabled).toBe(false);
});
