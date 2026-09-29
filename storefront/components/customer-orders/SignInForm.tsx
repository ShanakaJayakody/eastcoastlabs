'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestCustomerCode, verifyCustomerCode, customerSignOut } from '@/lib/customer-auth/actions';
export default function SignInForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    setBusy(true); setError('');
    try { const result = await requestCustomerCode(email); if (result.ok) { setSentTo(result.email!); setCode(''); } else setError(result.error!); }
    catch { setError('We couldn’t send a code. Please try again.'); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError('');
    try { const result = await verifyCustomerCode(code); if (result.ok) { router.replace(returnTo); router.refresh(); } else setError(result.error!); }
    catch { setError('We couldn’t verify your code. Please try again.'); } finally { setBusy(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); void (sentTo ? verify() : send()); }} className="co-form">
    {sentTo ? <><p>Enter the code sent to <strong>{sentTo}</strong>. It expires in 10 minutes.</p>
      <label htmlFor="customer-code">Email code</label><input id="customer-code" autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} required />
    </> : <><label htmlFor="customer-email">Email used at checkout</label><input id="customer-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /><p>We’ll send you a sign-in code. No password to remember.</p></>}
    {error && <p role="alert" className="co-form-error">{error}</p>}
    <button className="co-button" disabled={busy}>{busy ? 'Please wait…' : sentTo ? 'Verify and continue' : 'Send sign-in code'}</button>
    {sentTo && <div className="co-form-links"><button type="button" disabled={busy} onClick={() => void send()}>Send a new code</button><button type="button" disabled={busy} onClick={() => { setSentTo(null); setError(''); }}>Use another email</button></div>}
  </form>;
}
export function SignOutButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div><button className="co-text-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await customerSignOut(); router.replace('/account/sign-in'); router.refresh(); } catch { setError('Couldn’t sign out. Please try again.'); } finally { setBusy(false); } }}>Sign out</button>{error && <p role="alert">{error}</p>}</div>;
}
