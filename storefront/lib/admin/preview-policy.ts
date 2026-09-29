/** Server-controlled capability. A preview can never opt back into writes. */
export const PREVIEW_READ_ONLY_MESSAGE = 'Read-only preview: store changes are disabled.';
export function isReadOnlyPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.ADMIN_PREVIEW_READ_ONLY === '1';
}
export function assertPreviewWritable(): void {
  if (isReadOnlyPreview()) throw new Error(PREVIEW_READ_ONLY_MESSAGE);
}
