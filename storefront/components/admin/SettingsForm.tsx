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

  // Payment
  const [payidOn, setPayidOn] = useState(settings.payidEnabled);
  const [payid, setPayid] = useState(settings.payidIdentifier);
  const [payidName, setPayidName] = useState(settings.payidName);
  const [bankOn, setBankOn] = useState(settings.bankTransferEnabled);
  const [bsb, setBsb] = useState(settings.bankBsb);
  const [acct, setAcct] = useState(settings.bankAccountNumber);
  const [acctName, setAcctName] = useState(settings.bankAccountName);
  const [windowHours, setWindowHours] = useState(String(settings.paymentWindowHours));
  const [expiryHours, setExpiryHours] = useState(String(settings.paymentExpiryHours));

  // Shipping
  const [stdCents, setStdCents] = useState((settings.standardShippingCents / 100).toFixed(2));
  const [expressOn, setExpressOn] = useState(settings.expressShippingEnabled);
  const [expressCents, setExpressCents] = useState((settings.expressShippingCents / 100).toFixed(2));
  const [expressFree, setExpressFree] = useState(String(settings.expressFreeThreshold));

  const save = () =>
    start(async () => {
      const res = await saveSettings({
        announcementItems: items,
        freeShippingThreshold: Number(freeShip),
        giftThreshold: Number(gift),
        supportEmail: email,
        payidEnabled: payidOn,
        payidIdentifier: payid,
        payidName,
        bankTransferEnabled: bankOn,
        bankBsb: bsb,
        bankAccountNumber: acct,
        bankAccountName: acctName,
        paymentWindowHours: Number(windowHours),
        paymentExpiryHours: Number(expiryHours),
        standardShippingCents: Math.round(Number(stdCents) * 100),
        expressShippingEnabled: expressOn,
        expressShippingCents: Math.round(Number(expressCents) * 100),
        expressFreeThreshold: Number(expressFree),
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  const money = (v: string) => v.replace(/[^\d.]/g, "");

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
          <h3 className="text-sm font-semibold text-fg">Shipping rates</h3>
          <p className="mt-1 text-xs text-muted">
            What postage costs before the free thresholds above kick in.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Standard shipping (AUD)</label>
              <input
                value={stdCents}
                onChange={(e) => setStdCents(money(e.target.value))}
                className={field}
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={expressOn}
              onChange={(e) => setExpressOn(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium text-fg">Offer express shipping</span>
          </label>

          {expressOn && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Express shipping (AUD)</label>
                <input
                  value={expressCents}
                  onChange={(e) => setExpressCents(money(e.target.value))}
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Free express over (AUD)</label>
                <input
                  value={expressFree}
                  onChange={(e) => setExpressFree(money(e.target.value))}
                  className={field}
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Payment details</h3>
          <p className="mt-1 text-xs text-muted">
            Shown to customers on the confirmation page, the payment page, and in every payment
            email. A method with missing details is hidden at checkout rather than shown blank.
          </p>

          {/* ---- PayID ---- */}
          <div className="mt-4 rounded-lg border border-line bg-ink-2 p-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={payidOn}
                onChange={(e) => setPayidOn(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="text-sm font-semibold text-fg">PayID</span>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                Instant
              </span>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">
                  PayID (email, phone, or ABN)
                </label>
                <input
                  value={payid}
                  onChange={(e) => setPayid(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  Registered name (shown in their bank)
                </label>
                <input
                  value={payidName}
                  onChange={(e) => setPayidName(e.target.value)}
                  placeholder="East Coast Labs Pty Ltd"
                  className={field}
                />
              </div>
            </div>
          </div>

          {/* ---- Bank transfer ---- */}
          <div className="mt-3 rounded-lg border border-line bg-ink-2 p-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={bankOn}
                onChange={(e) => setBankOn(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="text-sm font-semibold text-fg">Bank transfer</span>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">BSB</label>
                <input
                  value={bsb}
                  onChange={(e) => setBsb(e.target.value)}
                  placeholder="063-000"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Account number</label>
                <input
                  value={acct}
                  onChange={(e) => setAcct(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="12345678"
                  className={field}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Account name</label>
                <input
                  value={acctName}
                  onChange={(e) => setAcctName(e.target.value)}
                  placeholder="East Coast Labs Pty Ltd"
                  className={field}
                />
              </div>
            </div>
          </div>

          {/* ---- Hold window ---- */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Tell customers we hold (hours)</label>
              <input
                value={windowHours}
                onChange={(e) => setWindowHours(e.target.value.replace(/[^\d]/g, ""))}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Auto-cancel unpaid orders after (hours)
              </label>
              <input
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value.replace(/[^\d]/g, ""))}
                className={field}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-2">
            Cancelling releases reserved stock back on sale. Reminder emails go out at 4h and 24h.
          </p>
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
          <h3 className="mb-2 text-sm font-semibold text-fg">How payment works</h3>
          <p className="text-xs leading-relaxed text-muted">
            Customers transfer by PayID or bank transfer quoting their order reference. Match the
            reference and the exact amount against your bank feed, then confirm the payment in
            Orders — that&apos;s what decrements stock and triggers the receipt.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Unpaid orders chase themselves: reminders at 4h and 24h, then automatic cancellation at
            the expiry you set, which puts the stock back on sale.
          </p>
        </section>
      </div>
    </div>
  );
}
