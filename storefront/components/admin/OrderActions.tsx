"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmPayment, correctTracking, advanceStatus, refund, cancel, addNote, reinstate } from "@/app/admin/(dashboard)/orders/actions";
import ConfirmModal from "./ConfirmModal";
import {formatAud} from "@/lib/format";
import type { OrderStatus, ReinstateLineCheck } from "@/lib/admin/orders";

const NEXT_LABEL: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  paid: { to: "processing", label: "Start packing" },
  processing: { to: "shipped", label: "Mark shipped" },
  shipped: { to: "completed", label: "Mark completed" },
};

export default function OrderActions({
  orderId,
  status,
  stockCheck,
  orderNumber, remainingRefundCents, trackingNumber, hasRefunds=false,
}: {
  orderId: string;
  orderNumber?:string;
  hasRefunds?:boolean;
  remainingRefundCents?:number;
  trackingNumber?:string|null;
  status: OrderStatus;
  /** Line-by-line availability, supplied only for cancelled orders. */
  stockCheck?: ReinstateLineCheck[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paymentRef, setPaymentRef] = useState("");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [note, setNote] = useState("");

  const reinstatementAttempt=useRef<{signature:string;key:string}|null>(null);
  const reinstateKey=(toPaid:boolean)=>{const signature=JSON.stringify({toPaid,paymentRef});if(reinstatementAttempt.current?.signature!==signature)reinstatementAttempt.current={signature,key:crypto.randomUUID()};return reinstatementAttempt.current.key;};
  const [confirming,setConfirming]=useState<"refund"|"cancel"|null>(null);
  const [restock,setRestock]=useState(false);
  const [notifyTracking,setNotifyTracking]=useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setConfirming(null);
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });

  const short = (stockCheck ?? []).filter((l) => !l.sufficient);
  const canReinstate = status === "cancelled" && short.length === 0 && !hasRefunds;

  const next = NEXT_LABEL[status];
  const closed = status === "cancelled" || status === "refunded";
  const btn =
    "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";
  const field =
    "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg">Actions</h3>
      <ConfirmModal open={confirming!==null} title={`${confirming==='refund'?'Record refund':'Cancel order'} · ${orderNumber ?? orderId}`} confirmLabel={confirming==='refund'?'Record refund':'Cancel order'} tone="danger" pending={pending} onCancel={()=>setConfirming(null)} onConfirm={()=>run(()=>confirming==='refund'?refund(orderId,restock):cancel(orderId,restock),confirming==='refund'?'Refund recorded — arrange the bank transfer separately':'Order cancellation recorded')} body={<>
        {confirming==='refund' && remainingRefundCents!=null && <p>Remaining refund: {formatAud(remainingRefundCents/100)}</p>}
        <p>This updates the order record. Money is not transferred; return any money owed through your bank separately. {confirming==='refund'?'A refund record email is queued for the customer.':'Cancellation does not send a refund confirmation.'}</p>
        {status!=='pending' && <label className="mt-3 flex gap-2"><input type="checkbox" checked={restock} onChange={e=>setRestock(e.target.checked)}/>Restore remaining units to sellable stock only if physically returned or still on hand.</label>}
      </>} />
      {(status==='shipped'||status==='completed') && <div className="space-y-2"><label className="block text-xs">Tracking number<input value={tracking} onChange={e=>setTracking(e.target.value)} className={field}/></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={notifyTracking} onChange={e=>setNotifyTracking(e.target.checked)}/>Email the customer this correction</label><button disabled={pending} className={`${btn} border border-line`} onClick={()=>run(()=>correctTracking(orderId,tracking,notifyTracking),'Tracking updated')}>Save tracking correction</button></div>}

      {status === "cancelled" && (
        <div className="space-y-2 rounded-lg border border-line-2 bg-ink-2/50 p-3">
          <p className="text-xs text-muted">
            Cancelled orders release their stock. Reinstating takes it back — which is only
            possible if it is still on the shelf.
          </p>

          {hasRefunds && <p role="alert" className="text-xs text-warn">This order has recorded refunds and cannot be reinstated. Create a new order if needed.</p>}
          {short.length > 0 ? (
            <div className="rounded-lg border border-warn/30 bg-warn/10 p-2.5 text-xs">
              <p className="font-medium text-warn">Not enough stock to reinstate</p>
              <ul className="mt-1 space-y-0.5 text-fg-2">
                {short.map((l) => (
                  <li key={l.variantId}>
                    {[l.productName, l.variantLabel].filter(Boolean).join(" · ")} — needs {l.qty},{" "}
                    {l.available} free
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-muted-2">Restock, then reinstate.</p>
            </div>
          ) : (
            <input
              placeholder="Payment reference (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className={field}
            />
          )}

          <button
            disabled={pending || !canReinstate}
            onClick={() =>
              run(
                () => reinstate(orderId, { toPaid: true, paymentRef, idempotencyKey:reinstateKey(true) }),
                "Reinstated and marked paid — stock decremented, customer emailed",
              )
            }
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Reinstate &amp; mark paid
          </button>
          <button
            disabled={pending || !canReinstate}
            onClick={() =>
              run(
                () => reinstate(orderId, { toPaid: false, idempotencyKey:reinstateKey(false) }),
                "Reinstated as awaiting payment — stock re-reserved",
              )
            }
            className={`${btn} w-full border border-line-2 bg-surface-2 text-fg-2 hover:text-fg`}
          >
            Reinstate as awaiting payment
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Payment is by bank transfer. Confirm once funds land — this decrements stock.
          </p>
          <input
            placeholder="Payment reference (optional)"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            className={field}
          />
          <button
            disabled={pending}
            onClick={() => run(() => confirmPayment(orderId, paymentRef), "Payment confirmed — stock decremented")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Confirm payment
          </button>
        </div>
      )}

      {status === "processing" || status === "paid" ? (
        <div className="space-y-2">
          <input
            placeholder="Tracking number"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className={field}
          />
          <button
            disabled={pending}
            onClick={() => run(() => advanceStatus(orderId, "shipped", tracking), "Marked shipped — customer emailed")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Mark shipped {tracking ? "with tracking" : ""}
          </button>
        </div>
      ) : null}

      {next && next.to !== "shipped" && (
        <button
          disabled={pending}
          onClick={() => run(() => advanceStatus(orderId, next.to), `Order ${next.to}`)}
          className={`${btn} w-full border border-line-2 bg-surface-2 text-fg hover:brightness-110`}
        >
          {next.label}
        </button>
      )}

      {!closed && (
        <div className="flex gap-2 border-t border-line pt-3">
          {status!=="pending" && <button
            disabled={pending}
            onClick={() => {setRestock(false);setConfirming("refund");}}
            className={`${btn} flex-1 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
          >
            Record refund
          </button>}
          {(status === "pending" || status === "paid") && (
            <button
              disabled={pending}
              onClick={() => {setRestock(false);setConfirming("cancel");}}
              className={`${btn} flex-1 border border-line-2 text-muted hover:text-fg`}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <textarea
          rows={2}
          placeholder="Add an internal note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              const r = await addNote(orderId, note);
              if (r.ok) setNote("");
              return r;
            }, "Note added")
          }
          className={`${btn} w-full border border-line-2 bg-surface-2 text-fg-2 hover:text-fg`}
        >
          Add note
        </button>
      </div>
    </div>
  );
}
