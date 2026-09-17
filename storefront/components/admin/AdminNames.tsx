"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveAdminName } from "@/app/admin/(dashboard)/settings/admin-name-actions";

export interface AdminNameRow { id: string; email: string; name: string | null }

function NameRow({ admin }: { admin: AdminNameRow }) {
  const router = useRouter();
  const [name, setName] = useState(admin.name ?? "");
  const [savedName, setSavedName] = useState(admin.name ?? "");
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      try {
        const result = await saveAdminName(admin.id, name);
        if (!result.ok) { toast.error(result.error ?? "Could not save name"); return; }
        setSavedName(name.trim());
        setName(name.trim());
        (result.warning ? toast.warning : toast.success)(result.warning ?? "Admin name saved");
        router.refresh();
      } catch { toast.error("Could not save name. Please try again."); }
    });
  }
  return <li className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0">
    <label className="block text-xs text-muted" htmlFor={`admin-name-${admin.id}`}>
      <span className="break-all">{admin.email}</span>
      <span className="mt-1 block font-medium text-fg-2">Display name</span>
    </label>
    <div className="flex gap-2">
      <input id={`admin-name-${admin.id}`} value={name} maxLength={80} disabled={pending} placeholder="e.g. Alex Chen"
        onChange={event => setName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"/>
      <button type="button" onClick={save} disabled={pending || !name.trim() || name.trim() === savedName}
        className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50">{pending ? "Saving…" : "Save name"}</button>
    </div>
  </li>;
}

export default function AdminNames({ admins }: { admins: AdminNameRow[] }) {
  return <section id="admin-names" className="scroll-mt-24 rounded-xl border border-line bg-surface p-4">
    <h3 className="text-sm font-semibold text-fg">Admin names</h3>
    <p className="mb-4 mt-1 text-xs text-muted">These names appear on new and existing stock receipts. Use a distinct name for each person.</p>
    <ul className="space-y-4">{admins.map(admin => <NameRow key={admin.id} admin={admin}/>)}</ul>
    <p className="mt-4 text-xs text-muted">These accounts can sign in. Names are for display; sign-in addresses stay the same.</p>
  </section>;
}
