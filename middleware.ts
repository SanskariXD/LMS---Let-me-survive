import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'slotwise_session';

export const config = {
  matcher: ['/portal/:path+', '/api/university/:path*'],
};

async function verifySessionCookie(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  try {
    const [payload, signature] = cookie.value.split('.');
    if (!payload || !signature) return false;

    // Verify HMAC using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    if (expectedSignature !== signature) return false;

    // Check expiry
    const raw = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof raw.expires !== 'number') return false;
    return raw.expires > Date.now() / 1000;
  } catch {
    return false;
  }
}

export default async function middleware(request: NextRequest) {
  const valid = await verifySessionCookie(request);

  if (!valid) {
    // For API routes, return 401 JSON
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'SESSION_INVALID' },
        { status: 401 },
      );
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}
