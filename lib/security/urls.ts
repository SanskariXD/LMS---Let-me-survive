export function safeExternalUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS URL required');
  return url.href;
}

export function safeResourceUrl(value: unknown): string {
  const url = safeExternalUrl(value);
  if (!new URL(url).hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error('Upload the file before sharing it.');
  return url;
}
