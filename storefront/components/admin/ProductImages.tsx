"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  uploadProductImage,
  removeProductImage,
  reorderProductImages,
} from "@/app/admin/(dashboard)/products/actions";

export default function ProductImages({
  slug,
  images: initialImages,
}: {
  slug: string;
  images: { src: string; alt?: string }[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadProductImage(slug, fd);
      if (res.ok && res.images) {
        setImages(res.images);
        toast.success(res.message ?? "Uploaded");
        router.refresh();
      } else toast.error(res.error ?? "Upload failed");
    });
  };

  const remove = (src: string) =>
    start(async () => {
      const res = await removeProductImage(slug, src);
      if (res.ok && res.images) {
        setImages(res.images);
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    start(async () => {
      const res = await reorderProductImages(slug, next.map((i) => i.src));
      if (!res.ok) toast.error(res.error ?? "Reorder failed");
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Images</h3>
        <button
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-2 transition hover:text-fg disabled:opacity-50"
        >
          <Upload size={13} /> Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted">
          No images yet — this product uses its seeded catalog image, if any. Upload one to override it.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.src} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-2">
              <Image src={img.src} alt={img.alt ?? ""} fill sizes="200px" className="object-contain p-1" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/80 px-1 py-1 opacity-0 transition group-hover:opacity-100">
                <button
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-1 text-fg-2 hover:text-fg disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  disabled={pending}
                  onClick={() => remove(img.src)}
                  className="rounded p-1 text-fg-2 hover:text-red-400"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
                <button
                  disabled={pending || i === images.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-1 text-fg-2 hover:text-fg disabled:opacity-30"
                  aria-label="Move later"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
