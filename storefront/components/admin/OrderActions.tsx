"use client";
import AdminWriteButton from "./AdminWriteButton";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmPayment, correctTracking, advanceStatus, cancel, addNote, reinstate, deleteOrder } from "@/app/admin/(dashboard)/orders/actions";
import ConfirmModal from "./ConfirmModal";
import RefundReview from "./RefundReview";
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
  orderNumber, trackingNumber, hasRefunds=false,
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
  const [confirming,setConfirming]=useState<"refund"|"cancel"|"delete"|null>(null);
  const [deleteConfirmation,setDeleteConfirmation]=useState("");
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
      {confirming==='refund' && <RefundReview orderId={orderId} selection={null} onClose={()=>setConfirming(null)}/>}
      <ConfirmModal open={confirming==='cancel'} title={`Cancel order · ${orderNumber ?? orderId}`} confirmLabel="Cancel order" tone="danger" pending={pending} onCancel={()=>setConfirming(null)} onConfirm={()=>run(()=>cancel(orderId,restock),'Order cancellation recorded')} body={<>
        <p>This updates the order record. Money is not transferred; return any money owed through your bank separately. Cancellation does not send a refund confirmation.</p>
        {status!=='pending' && <label className="mt-3 flex gap-2"><input type="checkbox" checked={restock} onChange={e=>setRestock(e.target.checked)}/>Restore remaining units to sellable stock only if physically returned or still on hand.</label>}
      </>} />
      {orderNumber && <ConfirmModal
        open={confirming==='delete'}
        title={`Permanently delete ${orderNumber}?`}
        confirmLabel="Permanently delete"
        tone="danger"
        pending={pending}
        confirmDisabled={deleteConfirmation!==orderNumber}
        onCancel={()=>{setConfirming(null);setDeleteConfirmation("");}}
        onConfirm={()=>start(async()=>{
          const result=await deleteOrder(orderId,deleteConfirmation);
          if(!result.ok){toast.error(result.error??"Action failed");return;}
          setConfirming(null);
          toast.success(`${orderNumber} permanently deleted`);
          router.push("/admin/orders");
        })}
        body={<div className="space-y-3">
          <p>This permanently removes the order from active customer, fulfilment, and reporting views. It cannot be undone.</p>
          <p>Paid stock is not returned to inventory. Refund, stock, legacy-pricing, and audit evidence is retained.</p>
          <label className="block text-xs font-medium text-fg">
            Type {orderNumber} to confirm
            <input
              value={deleteConfirmation}
              onChange={event=>setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              className={`${field} mt-1`}
            />
          </label>
        </div>}
      />}
      {(status==='shipped'||status==='completed') && <div className="space-y-2"><label className="block text-xs">Tracking number<input value={tracking} onChange={e=>setTracking(e.target.value)} className={field}/></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={notifyTracking} onChange={e=>setNotifyTracking(e.target.checked)}/>Email the customer this correction</label><AdminWriteButton disabled={pending} className={`${btn} border border-line`} onClick={()=>run(()=>correctTracking(orderId,tracking,notifyTracking),'Tracking updated')}>Save tracking correction</AdminWriteButton></div>}

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

          <AdminWriteButton
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
          </AdminWriteButton>
          <AdminWriteButton
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
          </AdminWriteButton>
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
          <AdminWriteButton
            disabled={pending}
            onClick={() => run(() => confirmPayment(orderId, paymentRef), "Payment confirmed — stock decremented")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Confirm payment
          </AdminWriteButton>
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
          <AdminWriteButton
            disabled={pending || !tracking.trim()}
            onClick={() => run(() => advanceStatus(orderId, "shipped", tracking), "Marked shipped — dispatch email queued")}
            className={`${btn} w-full bg-accent text-accent-ink hover:brightness-95`}
          >
            Mark shipped {tracking ? "with tracking" : ""}
          </AdminWriteButton>
          <p className="text-xs text-muted">A tracking number is required and will be included in the dispatch email.</p>
        </div>
      ) : null}

      {next && next.to !== "shipped" && (
        <AdminWriteButton
          disabled={pending}
          onClick={() => run(() => advanceStatus(orderId, next.to), `Order ${next.to}`)}
          className={`${btn} w-full border border-line-2 bg-surface-2 text-fg hover:brightness-110`}
        >
          {next.label}
        </AdminWriteButton>
      )}

      {!closed && (
        <div className="flex gap-2 border-t border-line pt-3">
          {status!=="pending" && <AdminWriteButton
            disabled={pending}
            onClick={() => {setRestock(false);setConfirming("refund");}}
            className={`${btn} flex-1 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
          >
            Record refund
          </AdminWriteButton>}
          {(status === "pending" || status === "paid") && (
            <AdminWriteButton
              disabled={pending}
              onClick={() => {setRestock(false);setConfirming("cancel");}}
              className={`${btn} flex-1 border border-line-2 text-muted hover:text-fg`}
            >
              Cancel
            </AdminWriteButton>
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
        <AdminWriteButton
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
        </AdminWriteButton>
      </div>

      {orderNumber && <div className="border-t border-line pt-3">
        <AdminWriteButton
          type="button"
          disabled={pending}
          onClick={()=>{setDeleteConfirmation("");setConfirming("delete");}}
          className={`${btn} w-full border border-red-500/30 text-red-400 hover:bg-red-500/10`}
        >
          Delete order
        </AdminWriteButton>
      </div>}
    </div>
  );
}
