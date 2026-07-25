"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { StoreSettings } from "@/lib/settings";
import { saveSettings } from "@/app/admin/(dashboard)/settings/actions";

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const btn = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";

export default function SettingsForm({
  settings,
  adminEmails,
}: {
  settings: StoreSettings;
  adminEmails: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<string[]>(settings.announcementItems);
  const [freeShip, setFreeShip] = useState(String(settings.freeShippingThreshold));
  const [gift, setGift] = useState(String(settings.giftThreshold));
  const [email, setEmail] = useState(settings.supportEmail);

  const save = () =>
    start(async () => {
      const res = await saveSettings({
        announcementItems: items,
        freeShippingThreshold: Number(freeShip),
        giftThreshold: Number(gift),
        supportEmail: email,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Announcement bar</h3>
          <p className="mt-1 text-xs text-muted">
            The trust strip above the header on every storefront page.
          </p>
          <div className="mt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={item}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
                  className={field}
                />
                <button
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  className="rounded-lg border border-line px-2 text-muted hover:text-fg"
                  aria-label="Remove item"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setItems([...items, ""])}
              className="flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Reward thresholds</h3>
          <p className="mt-1 text-xs text-muted">
            Drives the cart progress bar, free shipping at checkout, and the free bacteriostatic-water
            gift.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Free shipping over (AUD)</label>
              <input
                value={freeShip}
                onChange={(e) => setFreeShip(e.target.value.replace(/[^\d.]/g, ""))}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Free gift over (AUD)</label>
              <input
                value={gift}
                onChange={(e) => setGift(e.target.value.replace(/[^\d.]/g, ""))}
                className={field}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Store details</h3>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted">Support email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
        </section>

        <button
          disabled={pending}
          onClick={save}
          className={`${btn} bg-accent text-accent-ink hover:brightness-95`}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Admin users</h3>
          <ul className="space-y-1.5 text-sm">
            {adminEmails.map((e) => (
              <li key={e} className="truncate text-fg-2" title={e}>
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Only these addresses can sign in. Add or remove them in the{" "}
            <span className="font-mono">admin_users</span> table.
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Payments</h3>
          <p className="text-xs text-muted">
            Orders are taken by bank transfer and confirmed manually in Orders. Card payments switch
            on once Bankful merchant credentials are added.
          </p>
        </section>
      </div>
    </div>
  );
}
