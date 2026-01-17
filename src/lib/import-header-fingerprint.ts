export function normalizeHeaderValue(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const collapsed = trimmed.replace(/\s+/g, ' ');
  const noPunctuation = collapsed.replace(/[^a-z0-9 ]/g, '');
  return noPunctuation.replace(/\s+/g, '_');
}

export function normalizeHeaders(headers: string[]): string[] {
  return headers.map((header) => normalizeHeaderValue(header));
}

export async function computeHeaderFingerprint(headers: string[]): Promise<string> {
  const normalized = normalizeHeaders(headers);
  const payload = JSON.stringify(normalized);

  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  const { createHash } = await import('crypto');
  return createHash('sha256').update(payload).digest('hex');
}
