import { it, expect } from 'vitest';
import sharp from 'sharp';
import { prepareProductMedia } from '@/lib/product-media';
it('publishes stable JPEG product and email images without retaining image metadata',async()=>{
 const source=await sharp({create:{width:800,height:600,channels:3,background:'#ffffff'}}).webp().toBuffer();
 const out=await prepareProductMedia(source);
 const thumb=await sharp(out.thumbnail).metadata();
 expect(thumb.format).toBe('jpeg');expect(thumb.width).toBe(240);expect(thumb.height).toBe(240);expect(thumb.exif).toBeUndefined();
 expect(out.digest).toMatch(/^[a-f0-9]{64}$/);
 expect((await prepareProductMedia(source)).digest).toBe(out.digest);
});
it('rejects non-images and excessive decoded dimensions',async()=>{
 await expect(prepareProductMedia(Buffer.from('not an image'))).rejects.toThrow();
});
