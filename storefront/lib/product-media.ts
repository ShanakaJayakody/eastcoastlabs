import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** Decode bounded pixels, strip metadata and publish content-addressed JPEGs.
 * Product publication owns this work; placing an order never fetches/converts images. */
export async function prepareProductMedia(input: Buffer) {
  if (!input.length || input.length > 8 * 1024 * 1024) throw new Error('Image must be under 8MB');
  const decoded = sharp(input, { limitInputPixels: 24_000_000, animated: false }).rotate();
  const image = await decoded.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  const thumbnail = await decoded.clone().resize(240, 240, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
  return { image, thumbnail, digest: createHash('sha256').update(image).digest('hex') };
}
