// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductImages from '@/components/admin/ProductImages';

const m = vi.hoisted(() => ({
  prepare: vi.fn(), complete: vi.fn(), remove: vi.fn(), refresh: vi.fn(),
  success: vi.fn(), error: vi.fn(), legacyUpload: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('sonner', () => ({ toast: { success: m.success, error: m.error } }));
vi.mock('@/app/admin/(dashboard)/products/actions', () => ({
  createProductImageUpload: m.prepare, completeProductImageUpload: m.complete,
  uploadProductImage: m.legacyUpload, removeProductImage: m.remove, reorderProductImages: vi.fn(),
}));
const signedUrl = 'https://storage.example.test/upload/sign/product-images/5-amino/photo.png?token=test';
const photo = { src: 'https://storage.example.test/5-amino/new.png', alt: '5-Amino' };
beforeEach(() => {
  m.prepare.mockResolvedValue({ ok: true, path: '5-amino/photo.png', signedUrl });
  m.complete.mockResolvedValue({ ok: true, images: [photo], message: 'Image uploaded' });
  m.remove.mockResolvedValue({ ok: true, images: [] });
  m.legacyUpload.mockResolvedValue({ ok: false, error: 'Body exceeded 1 MB limit' });
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function selectFile(container: HTMLElement, size = 6 * 1024 * 1024) {
  const file = new File([new Uint8Array(size)], 'orange-powder.png', { type: 'image/png' });
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } });
  return file;
}

it('replaces the last removed image with a 6 MB photo without sending its bytes through a server action', async () => {
  const view = render(<ProductImages slug="5-amino" images={[{ src: '/old.png', alt: 'Old photo' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
  await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
  const file = selectFile(view.container);
  await waitFor(() => expect(decodeURIComponent(screen.getByRole('img', { name: '5-Amino' }).getAttribute('src') ?? '')).toContain(photo.src));
  expect(m.prepare).toHaveBeenCalledWith('5-amino', { name: file.name, type: 'image/png', size: file.size });
  expect(fetch).toHaveBeenCalledWith(signedUrl, expect.objectContaining({ method: 'PUT', body: file }));
  expect(m.complete).toHaveBeenCalledWith('5-amino', '5-amino/photo.png');
  expect(m.legacyUpload).not.toHaveBeenCalled();
});

it('keeps the current photo and allows retry when storage rejects an upload', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
  const view = render(<ProductImages slug="5-amino" images={[{ src: '/old.png', alt: 'Old photo' }]} />);
  selectFile(view.container);
  await waitFor(() => expect(m.error).toHaveBeenCalled());
  expect(screen.getByRole('img', { name: 'Old photo' })).toBeInTheDocument();
  expect(m.complete).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled());
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
  selectFile(view.container);
  await waitFor(() => expect(screen.getByRole('img', { name: '5-Amino' })).toBeInTheDocument());
});

it('shows a recoverable error when a server action cannot be reached', async () => {
  m.prepare.mockRejectedValue(new Error('Network unavailable'));
  const view = render(<ProductImages slug="5-amino" images={[]} />);
  selectFile(view.container);
  await waitFor(() => expect(m.error).toHaveBeenCalledWith(expect.stringMatching(/try again/i)));
  expect(m.complete).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
});

it('rejects files over 8 MB before requesting an upload', async () => {
  const view = render(<ProductImages slug="5-amino" images={[]} />);
  selectFile(view.container, 8 * 1024 * 1024 + 1);
  await waitFor(() => expect(m.error).toHaveBeenCalledWith(expect.stringMatching(/8\s?MB/i)));
  expect(m.prepare).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
