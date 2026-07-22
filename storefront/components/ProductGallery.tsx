"use client";

import { useState } from "react";
import Image from "next/image";
import type { WooImage } from "@/lib/woo";

export default function ProductGallery({ images, name }: { images: WooImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const hasImages = images && images.length > 0;
  const current = hasImages ? images[Math.min(active, images.length - 1)] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-ink-2">
        {current ? (
          <Image
            src={current.src}
            alt={current.alt || name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-contain p-6"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-6xl text-muted-2">🧪</div>
        )}
      </div>

      {hasImages && images.length > 1 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 overflow-hidden rounded-md border bg-ink-2 ${
                i === active ? "border-accent" : "border-line hover:border-line-2"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img.thumbnail || img.src}
                alt={img.alt || `${name} thumbnail ${i + 1}`}
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
