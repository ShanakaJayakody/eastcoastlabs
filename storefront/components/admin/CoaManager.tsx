"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, FileText } from "lucide-react";
import Badge from "./Badge";
import { saveCoaBatch, deleteCoaBatch } from "@/app/admin/(dashboard)/coas/actions";

export interface CoaRow {
  batch_id: string;
  compound: string;
  purity_pct: number;
  lab: string;
  test_date: string;
  coa_url: string | null;
  lab_verify_url: string | null;
}

const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

export default function CoaManager({
  batches,
  compounds,
}: {
  batches: CoaRow[];
  compounds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveCoaBatch(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        formRef.current?.reset();
        setShow(false);
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  };

  const remove = (batchId: string) =>
    start(async () => {
      const res = await deleteCoaBatch(batchId);
      if (res.ok) {
        toast.success(res.message ?? "Deleted");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {batches.length} published batches · shown on <span className="text-fg-2">/lab-results</span> and
          the batch verify tool
        </p>
        <button
          onClick={() => setShow((v) => !v)}
          className={`${btn} flex items-center gap-1.5 border border-line-2 bg-surface text-fg-2 hover:text-fg`}
        >
          <Plus size={15} /> Add batch
        </button>
      </div>

      {show && (
        <form ref={formRef} onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">Publish a certificate of analysis</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Batch ID</label>
              <input name="batch_id" required className={`${field} font-mono`} placeholder="88934" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Compound</label>
              <input name="compound" required list="compound-list" className={field} placeholder="BPC-157" />
              <datalist id="compound-list">
                {compounds.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Purity %</label>
              <input name="purity_pct" required className={field} placeholder="99.82" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Lab</label>
              <input name="lab" defaultValue="JanoShik" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Test date</label>
              <input name="test_date" type="date" required className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Lab verify URL (optional)</label>
              <input name="lab_verify_url" className={field} placeholder="https://…" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">COA PDF (optional, max 10MB)</label>
            <input
              name="pdf"
              type="file"
              accept="application/pdf"
              className="block w-full text-sm text-fg-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-fg-2"
            />
          </div>
          <button disabled={pending} className={`${btn} bg-accent text-accent-ink hover:brightness-95`}>
            {pending ? "Saving…" : "Publish batch"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Batch</th>
              <th className="px-4 py-2.5 font-medium">Compound</th>
              <th className="px-4 py-2.5 font-medium">Purity</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Lab</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Tested</th>
              <th className="px-4 py-2.5 font-medium">PDF</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {batches.map((b) => (
              <tr key={b.batch_id} className="transition hover:bg-surface-2">
                <td className="px-4 py-3 font-mono text-accent">{b.batch_id}</td>
                <td className="px-4 py-3 text-fg-2">{b.compound}</td>
                <td className="px-4 py-3">
                  <Badge tone={b.purity_pct >= 98 ? "success" : "warn"}>{b.purity_pct}%</Badge>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{b.lab}</td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  {new Date(b.test_date).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3">
                  {b.coa_url ? (
                    <a
                      href={b.coa_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent-2 hover:underline"
                    >
                      <FileText size={14} /> View
                    </a>
                  ) : (
                    <span className="text-xs text-muted-2">none</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Delete batch ${b.batch_id}?`)) remove(b.batch_id);
                    }}
                    className="text-muted hover:text-red-400"
                    aria-label={`Delete ${b.batch_id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
