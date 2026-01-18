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

export async function computeHeaderSignature({
  headers,
  rows,
  sampleSize = 5,
}: {
  headers: string[]
  rows: Array<Record<string, string>>
  sampleSize?: number
}): Promise<string> {
  const normalizedHeaders = normalizeHeaders(headers)
  const sampleRows = rows.slice(0, sampleSize).map((row) =>
    headers.map((header) => (row[header] ?? '').trim())
  )
  const payload = JSON.stringify({
    headers: normalizedHeaders,
    sampleRows,
  })

  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  const { createHash } = await import('crypto')
  return createHash('sha256').update(payload).digest('hex')
}
