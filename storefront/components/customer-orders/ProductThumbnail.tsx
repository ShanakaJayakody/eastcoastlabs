'use client';
import { useState } from 'react';
import Image from 'next/image';
export default function ProductThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="co-photo">{src && !failed
    ? <Image src={src} alt={alt} width={96} height={96} unoptimized onError={() => setFailed(true)} />
    : <span aria-label="Product image unavailable">ECL</span>}</div>;
}
