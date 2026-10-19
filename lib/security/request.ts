import { NextRequest, NextResponse } from 'next/server';

// Apply in handlers as well as middleware: headers are never an identity boundary.
export function guardMutation(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Open this action from your LMS portal.' }, { status: 403 });
  }
  const limit = request.nextUrl.pathname === '/api/resources/upload' ? 26 * 1024 * 1024 : 128 * 1024;
  const length = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(length) || length < 0 || length > limit) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }
  return null;
}

export async function readBody(request: Request, maxBytes = 128 * 1024): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('JSON_REQUIRED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('BODY_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Existing route schemas validate individual fields; reject non-object JSON here.
export async function readJson(request: Request): Promise<Record<string, any>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = JSON.parse((await readBody(request)).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
