"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  label?: string;
}

/** Keep the rich editor and its dependencies out of the initial product bundle. */
export default function DescriptionEditor({ value, onChange, minHeight = 160, label }: EditorProps & { label: string }) {
  const [editing, setEditing] = useState(false);
  const [RichEditor, setRichEditor] = useState<ComponentType<EditorProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rich, setRich] = useState(false);
  const typedWhileLoading = useRef(false);
  const source = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing && !rich) source.current?.focus();
  }, [editing, rich]);

  async function edit() {
    setEditing(true);
    setLoading(true);
    setFailed(false);
    try {
      const editorModule = await import("./RichTextEditor");
      setRichEditor(() => editorModule.default);
      // Do not replace an actively used textarea or move its caret when the
      // network finishes. The operator can switch with the current draft later.
      if (!typedWhileLoading.current) setRich(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        {!editing && <button type="button" onClick={edit} className="text-xs text-accent-2 underline">{label === "Full description" ? "Edit description" : "Edit short description"}</button>}
        {editing && RichEditor && !rich && <button type="button" onClick={() => setRich(true)} className="text-xs text-accent-2 underline">Use formatting tools</button>}
      </div>
      {editing && rich && RichEditor ? <RichEditor value={value} onChange={onChange} minHeight={minHeight} label={label} /> : (
        <textarea
          ref={source}
          aria-label={editing ? label : `${label} preview`}
          readOnly={!editing}
          value={value}
          onChange={(event) => { typedWhileLoading.current = true; onChange(event.target.value); }}
          style={{ minHeight }}
          className="w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
      )}
      {!rich && <p className="mt-1 text-xs text-muted">{editing ? "HTML source. Changes are included when you save the product." : "Description preview (HTML source)."}</p>}
      {loading && <p role="status" className="mt-1 text-xs text-muted">Loading formatting tools. You can edit the HTML source now.</p>}
      {failed && <p role="status" className="mt-1 text-xs text-muted">Formatting tools could not load. You can keep editing the HTML source. <button type="button" onClick={edit} className="underline">Retry formatting tools</button></p>}
    </div>
  );
}
