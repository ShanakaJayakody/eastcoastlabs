"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveCustomerDetails } from "@/app/admin/(dashboard)/customers/profile-actions";
import type { CustomerContact, CustomerDetailsInput, CustomerAddress } from "@/lib/admin/customer-details";

const addressFields: { key: keyof CustomerAddress; label: string; autoComplete: string }[] = [
  { key: "line1", label: "Address line 1", autoComplete: "address-line1" },
  { key: "line2", label: "Address line 2", autoComplete: "address-line2" },
  { key: "suburb", label: "Suburb / city", autoComplete: "address-level2" },
  { key: "state", label: "State / region", autoComplete: "address-level1" },
  { key: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { key: "country", label: "Country", autoComplete: "country" },
];

function draftFor(customer: CustomerContact): CustomerDetailsInput {
  return {
    email: customer.email, name: customer.name ?? "", phone: customer.phone ?? "",
    address: Object.fromEntries(addressFields.map(({ key }) => [key, customer.address[key] ?? ""])),
  };
}

export default function CustomerDetails({ customer }: { customer: CustomerContact }) {
  const router = useRouter();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFor(customer));
  const [revision, setRevision] = useState(customer.version);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputClass = "mt-1 w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent disabled:opacity-50";

  const submit = () => start(async () => {
    setError(null);
    try {
      const result = await saveCustomerDetails(customer.email, draft, revision);
      if (!result.ok) { setError(result.message); return; }
      setEditing(false);
      toast.success(result.message);
      if (result.email !== customer.email) router.replace(`/admin/customers/${encodeURIComponent(result.email)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save customer details. Please try again.");
    }
  });

  const addressLines = [customer.address.line1, customer.address.line2,
    [customer.address.suburb, customer.address.state, customer.address.postcode].filter(Boolean).join(" "), customer.address.country].filter(Boolean);

  return (
    <section className="admin-card rounded-xl p-4" aria-labelledby={`${id}-title`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-sm font-semibold text-fg">Customer details</h3>
        {!editing && <button type="button" onClick={() => {
          setDraft(draftFor(customer)); setRevision(customer.version); setError(null); setEditing(true);
        }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-2 hover:border-accent">
          <Pencil size={13} /> Edit details
        </button>}
      </div>
      {editing ? (
        <form onSubmit={event => { event.preventDefault(); submit(); }} className="mt-4 space-y-4">
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {([{ key: "email", label: "Email", type: "email", max: 254 }, { key: "name", label: "Name", type: "text", max: 300 }, { key: "phone", label: "Phone", type: "tel", max: 50 }] as const).map(field => (
              <label key={field.key} htmlFor={`${id}-${field.key}`} className="text-xs font-medium text-fg-2">{field.label}
                <input id={`${id}-${field.key}`} name={field.key} type={field.type} autoComplete={field.key === "phone" ? "tel" : field.key} required={field.key === "email"} maxLength={field.max}
                  value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} className={inputClass} />
              </label>
            ))}
            {addressFields.map(field => (
              <label key={field.key} htmlFor={`${id}-${field.key}`} className="text-xs font-medium text-fg-2">{field.label}
                <input id={`${id}-${field.key}`} name={field.key} autoComplete={field.autoComplete} maxLength={300} value={draft.address[field.key] ?? ""}
                  onChange={event => setDraft({ ...draft, address: { ...draft.address, [field.key]: event.target.value } })} className={inputClass} />
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted">Name, phone and address update this customer profile. Delivery details on existing orders stay as recorded.</p>
          {draft.email.trim().toLowerCase() !== customer.email && <p className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-fg-2">
            Orders, notes and future email will use the new email address. Existing subscription confirmation and cart recovery links will expire.
          </p>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setError(null); }} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg-2 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50">{pending ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted">Email</dt><dd className="mt-1 break-all text-fg-2">{customer.email}</dd></div>
          <div><dt className="text-xs text-muted">Name</dt><dd className="mt-1 text-fg-2">{customer.name || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted">Phone</dt><dd className="mt-1 text-fg-2">{customer.phone || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted">Address</dt><dd className="mt-1 text-fg-2">{addressLines.length ? addressLines.map((line, index) => <span key={index} className="block">{line}</span>) : "Not provided"}</dd></div>
        </dl>
      )}
    </section>
  );
}
