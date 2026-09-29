'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
export default function RefreshStatus() {
  const router=useRouter();const [pending,startTransition]=useTransition();
  return <button className="co-text-button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Checking payment…':'Refresh payment status'}</button>;
}
