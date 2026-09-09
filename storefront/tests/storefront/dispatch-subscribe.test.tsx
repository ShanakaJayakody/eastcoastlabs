// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const boundary=vi.hoisted(()=>({rpc:vi.fn(),after:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({rpc:boundary.rpc})}));
vi.mock('next/server',async importOriginal=>({...await importOriginal<typeof import('next/server')>(),after:boundary.after}));
import {POST} from '@/app/api/subscribe/route';
import DispatchSubscribe from '@/components/variant/v2/DispatchSubscribe';
afterEach(cleanup);
it('the dossier newsletter passes real subscription validation and requests mailbox confirmation',async()=>{
 boundary.rpc.mockResolvedValue({data:'synthetic-confirmation-message',error:null});
 const responses:Response[]=[];
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
  expect(url).toBe('/api/subscribe');
  const response=await POST(new Request('http://localhost/api/subscribe',init));
  responses.push(response.clone());return response;
 });
 render(<DispatchSubscribe/>);
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'reader@example.test'}});
 fireEvent.submit(screen.getByRole('button',{name:'Subscribe'}).closest('form')!);
 await waitFor(()=>expect(responses).toHaveLength(1));
 expect(await responses[0].json()).toEqual({ok:true,message:'Check your email to confirm your subscription.'});
 expect(responses[0].status).toBe(200);
 expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm your subscription.');
 expect(boundary.rpc).toHaveBeenCalledWith('request_subscription',expect.objectContaining({p_email:'reader@example.test',p_source:'newsletter',p_hash:expect.stringMatching(/^[a-f0-9]{64}$/),p_url:expect.stringMatching(/^https:\/\/www.eastcoastlabs.com.au\/subscribe\/confirm\?token=/)}));
 expect(boundary.after).toHaveBeenCalledWith(expect.any(Function));
});
