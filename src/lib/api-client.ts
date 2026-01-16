export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await parseResponse(response);

  const hasOk =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'ok' in payload;

  if (!response.ok || (hasOk && !(payload as { ok: boolean }).ok)) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[api] Request failed', {
        url: typeof input === 'string' ? input : input.toString(),
        status: response.status,
        payload,
      });
    }

    const errorMessage =
      hasOk && 'error' in (payload as { error?: string })
        ? String((payload as { error?: string }).error)
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  if (hasOk && 'data' in (payload as { data: T })) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}
