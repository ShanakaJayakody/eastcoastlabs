// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
afterEach(cleanup);
import EmailCapture from '@/components/EmailCapture';
it('shows the server confirmation state instead of claiming subscribed',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:()=>Promise.resolve({ok:true,message:'Check your email to confirm your subscription.'})}));render(<EmailCapture source='footer' successMsg='Already subscribed'/>);fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'p@example.test'}});fireEvent.submit(screen.getByRole('button').closest('form')!);expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm your subscription.');expect(screen.queryByText('Already subscribed')).toBeNull();});
it('exposes delivery failure accessibly on every viewport',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));render(<EmailCapture source='footer'/>);fireEvent.submit(screen.getByRole('button').closest('form')!);expect(await screen.findByRole('alert')).not.toHaveClass('sm:sr-only');});
