import DispatchSubscribe from "./DispatchSubscribe";

/** 07 / DISPATCH — logistics facts + correspondence, three mono-labelled columns. */
export default function DispatchGrid({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  const COLS = [
    {
      label: "Dispatch",
      content: (
        <>
          <p className="font-serif-display text-xl text-fg">After payment confirmation</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Bank transfer details are provided after placing your order. Orders are prepared after payment confirmation.
          </p>
        </>
      ),
    },
    {
      label: "Shipping",
      content: (
        <>
          <p className="font-serif-display text-xl text-fg">Free over ${freeShippingThreshold}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Every order below the threshold ships at a flat rate, calculated at checkout alongside
            any applicable taxes.
          </p>
        </>
      ),
    },
    {
      label: "Correspondence",
      content: (
        <>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Batch releases and restock notices. Nothing else.
          </p>
          <DispatchSubscribe />
        </>
      ),
    },
  ];

  return (
    <div className="grid gap-10 border-t border-line-2 pt-8 sm:grid-cols-3 sm:gap-8">
      {COLS.map((col) => (
        <div key={col.label}>
          <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted-2">{col.label}</p>
          <div className="mt-3">{col.content}</div>
        </div>
      ))}
    </div>
  );
}
