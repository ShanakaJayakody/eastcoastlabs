"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  LinkIcon,
  Undo,
  Redo,
} from "lucide-react";

/**
 * Minimal on-brand rich-text editor. Outputs/accepts HTML — a drop-in
 * replacement for the raw `<textarea>` the product editor used to hand the
 * client, since descriptions are stored and rendered as HTML throughout the
 * storefront (product pages, prose-ecl blocks).
 */
export default function RichTextEditor({
  value,
  onChange,
  minHeight = 160,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-accent-2 underline" } }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-ecl max-w-none focus:outline-none px-3 py-2 text-sm text-fg-2",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded p-1.5 text-fg-2 transition hover:bg-surface-2 hover:text-fg ${active ? "bg-surface-2 text-accent" : ""}`;

  return (
    <div className="rounded-lg border border-line bg-ink-2 focus-within:border-accent">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
          aria-label="Bold"
        >
          <BoldIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
          aria-label="Italic"
        >
          <ItalicIcon size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-line-2" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive("heading", { level: 2 }))}
          aria-label="Heading 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive("heading", { level: 3 }))}
          aria-label="Heading 3"
        >
          <Heading3 size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-line-2" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
          aria-label="Bullet list"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
          aria-label="Numbered list"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={btn(editor.isActive("link"))}
          aria-label="Link"
        >
          <LinkIcon size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-line-2" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={btn(false)}
          aria-label="Undo"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={btn(false)}
          aria-label="Redo"
        >
          <Redo size={15} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
