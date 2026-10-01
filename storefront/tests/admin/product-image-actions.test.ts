import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  auth: vi.fn(), product: vi.fn(), save: vi.fn(), sign: vi.fn(), info: vi.fn(), revalidate: vi.fn(),
  download: vi.fn(), upload: vi.fn(), remove: vi.fn(), media: vi.fn(),
}));
vi.mock('@/lib/admin/auth', () => ({ requireAdmin: m.auth }));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }));
vi.mock('@/lib/admin/products', () => ({ getProductBySlug: m.product, setProductImages: m.save }));
vi.mock('@/lib/product-media', () => ({ prepareProductMedia: m.media }));
vi.mock('@/lib/admin/db', () => ({ adminDb: () => ({ storage: { from: (bucket: string) => {
  if (bucket !== 'product-images') throw new Error('Wrong bucket');
  return { createSignedUploadUrl: m.sign, info: m.info, download: m.download, upload: m.upload, remove: m.remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example.test/${path}` } }) };
} } }) }));
import { createProductImageUpload, completeProductImageUpload } from '@/app/admin/(dashboard)/products/actions';

const path = '5-amino/12345678-1234-4234-8234-123456789abc.png';
const file = { name: 'orange powder.PNG', type: 'image/png', size: 6 * 1024 * 1024 };
const image = { src: 'https://storage.example.test/5-amino/processed-digest.jpg', email_src: 'https://storage.example.test/5-amino/processed-digest-email.jpg', alt: '5-Amino', size_label: '50 mg' };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ email: 'operator@example.test' });
  m.product.mockResolvedValue({ slug: '5-amino', name: '5-Amino', size_label: '50 mg', images: [] });
  m.sign.mockImplementation(async (path: string) => ({ data: { path, signedUrl: 'https://storage.example.test/signed?token=test', token: 'test' }, error: null }));
  m.info.mockResolvedValue({ data: { size: file.size, contentType: 'image/png' }, error: null });
  m.save.mockResolvedValue(undefined);
  m.download.mockResolvedValue({ data: new Blob(['original image bytes'], { type: 'image/png' }), error: null });
  m.media.mockResolvedValue({ image: Buffer.from('optimized'), thumbnail: Buffer.from('thumbnail'), digest: 'processed-digest' });
  m.upload.mockResolvedValue({ data: {}, error: null });
  m.remove.mockResolvedValue({ data: [], error: null });
});

it('authorizes a direct upload larger than both application-server payload limits without changing the product', async () => {
  const result = await createProductImageUpload('5-amino', file);
  expect(result).toMatchObject({ ok: true, signedUrl: expect.stringMatching(/^https:/), path: expect.stringMatching(/^5-amino\/[0-9a-f-]{36}\.png$/) });
  expect(m.sign).toHaveBeenCalledWith(result.path, { upsert: false });
  expect(m.save).not.toHaveBeenCalled();
});

it.each([{ ...file, size: 0 }, { ...file, size: 8 * 1024 * 1024 + 1 }, { ...file, type: 'application/pdf' }])('rejects invalid upload metadata before signing: %j', async (invalid) => {
  expect(await createProductImageUpload('5-amino', invalid)).toMatchObject({ ok: false });
  expect(m.sign).not.toHaveBeenCalled();
});

it('requires admin authentication for both upload steps', async () => {
  m.auth.mockRejectedValue(new Error('Forbidden'));
  await expect(createProductImageUpload('5-amino', file)).rejects.toThrow('Forbidden');
  await expect(completeProductImageUpload('5-amino', path)).rejects.toThrow('Forbidden');
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it('keeps both upload steps disabled in the read-only admin preview', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  await expect(createProductImageUpload('5-amino', file)).rejects.toThrow(/read-only/i);
  await expect(completeProductImageUpload('5-amino', path)).rejects.toThrow(/read-only/i);
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it('attaches the verified upload after removal and refreshes public catalogue views', async () => {
  const result = await completeProductImageUpload('5-amino', path);
  const images = [image];
  expect(result).toMatchObject({ ok: true, images });
  expect(m.info).toHaveBeenCalledWith(path);
  expect(m.save).toHaveBeenCalledWith('5-amino', images, 'operator@example.test');
  expect(m.media).toHaveBeenCalledWith(Buffer.from('original image bytes'));
  expect(m.upload).toHaveBeenCalledWith('5-amino/processed-digest.jpg', Buffer.from('optimized'), { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  expect(m.upload).toHaveBeenCalledWith('5-amino/processed-digest-email.jpg', Buffer.from('thumbnail'), { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  expect(m.remove).toHaveBeenCalledWith([path]);
  expect(m.revalidate).toHaveBeenCalledWith('/shop');
  expect(m.revalidate).toHaveBeenCalledWith('/product/5-amino');
});

it.each(['other/' + path.split('/')[1], '5-amino/../other.png', 'https://external.example/image.png'])('rejects a foreign or malformed storage path: %s', async (invalid) => {
  expect(await completeProductImageUpload('5-amino', invalid)).toMatchObject({ ok: false });
  expect(m.info).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it.each([
  { data: null, error: { message: 'Object not found' } },
  { data: { size: 9 * 1024 * 1024, contentType: 'image/png' }, error: null },
  { data: { size: 100, contentType: 'text/html' }, error: null },
  { data: { contentType: 'image/png' }, error: null },
])('does not attach a missing or invalid stored file: %j', async (info) => {
  m.info.mockResolvedValue(info);
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: false });
  expect(m.save).not.toHaveBeenCalled();
});

it('preserves another image and avoids duplicates when the same photo is uploaded again', async () => {
  const images = [{ src: '/existing.png' }, image];
  m.product.mockResolvedValue({ name: '5-Amino', images });
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: true, images });
  expect(m.save).not.toHaveBeenCalled();
});

it('leaves the product unchanged if decoding the uploaded file fails', async () => {
  m.media.mockRejectedValue(new Error('Unsupported image data'));
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: false });
  expect(m.save).not.toHaveBeenCalled();
  expect(m.remove).toHaveBeenCalledWith([path]);
});

it('does not publish a photo if its email thumbnail upload fails', async () => {
  m.upload.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'Storage unavailable' } });
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: false });
  expect(m.save).not.toHaveBeenCalled();
  expect(m.remove).toHaveBeenCalledWith([path]);
});

it('can attach existing immutable assets without overwriting them', async () => {
  m.upload.mockResolvedValue({ data: null, error: { message: 'The resource already exists' } });
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: true, images: [image] });
});

it('still reports a successful save if staging-file cleanup fails', async () => {
  m.remove.mockRejectedValue(new Error('Cleanup unavailable'));
  expect(await completeProductImageUpload('5-amino', path)).toMatchObject({ ok: true, images: [image] });
});
