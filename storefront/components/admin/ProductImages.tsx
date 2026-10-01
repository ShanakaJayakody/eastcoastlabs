"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import AdminWriteButton from "./AdminWriteButton";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createProductImageUpload,
  completeProductImageUpload,
  removeProductImage,
  reorderProductImages,
} from "@/app/admin/(dashboard)/products/actions";
import { productImageError } from "@/lib/product-images";

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
    const error = productImageError(file);
    if (error) {
      toast.error(error);
      return;
    }
    start(async () => {
      try {
        const upload = await createProductImageUpload(slug, { name: file.name, type: file.type, size: file.size });
        if (!upload.ok || !upload.signedUrl || !upload.path) {
          toast.error(upload.error ?? "Could not start the upload. Please try again.");
          return;
        }
        // The scoped, temporary URL authorizes this file only; no service key
        // or photo bytes are sent through the application server.
        const response = await fetch(upload.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          toast.error("Image upload failed. Please try again.");
          return;
        }
        const res = await completeProductImageUpload(slug, upload.path);
        if (res.ok && res.images) {
          setImages(res.images);
          toast.success(res.message ?? "Uploaded");
          router.refresh();
        } else toast.error(res.error ?? "Could not save the image. Please try again.");
      } catch {
        toast.error("Could not upload the image. Check your connection and try again.");
      }
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
        <AdminWriteButton
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-2 transition hover:text-fg disabled:opacity-50"
        >
          <Upload size={13} /> {pending ? "Working…" : "Upload"}
        </AdminWriteButton>
        <input
          ref={fileRef}
          type="file"
          disabled={pending}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mb-3 text-xs text-muted">Images up to 8MB. Uploads save automatically.</p>

      {images.length === 0 ? (
        <p className="text-sm text-muted">
          No images yet. Upload a product photo to show it on the website.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.src} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-2">
              <Image src={img.src} alt={img.alt ?? ""} fill sizes="200px" className="object-contain p-1" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/80 px-1 py-1 opacity-0 transition group-hover:opacity-100">
                <AdminWriteButton
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-1 text-fg-2 hover:text-fg disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  <ChevronLeft size={13} />
                </AdminWriteButton>
                <AdminWriteButton
                  disabled={pending}
                  onClick={() => remove(img.src)}
                  className="rounded p-1 text-fg-2 hover:text-red-400"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </AdminWriteButton>
                <AdminWriteButton
                  disabled={pending || i === images.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-1 text-fg-2 hover:text-fg disabled:opacity-30"
                  aria-label="Move later"
                >
                  <ChevronRight size={13} />
                </AdminWriteButton>
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
