import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'slotwise_session';

export const config = {
  matcher: ['/portal/:path*', '/api/:path*'],
};

async function verifySessionCookie(request: NextRequest): Promise<{ valid: boolean; userId?: string }> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return { valid: false };

  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      return { valid: false };
    }
    secret = 'slotwise-dev-fallback-secret-for-session-signing-at-least-32-chars';
  }

  try {
    const [payload, signature, extra] = cookie.value.split('.');
    if (!payload || !signature || extra) return { valid: false };

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

    if (expectedSignature !== signature) return { valid: false };

    // Check expiry
    const raw = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof raw.expires !== 'number' || raw.expires < Date.now() / 1000) {
      return { valid: false };
    }

    return { valid: true, userId: raw.userId };
  } catch {
    return { valid: false };
  }
}

export default async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return NextResponse.json({error: 'Forbidden'}, {status: 403});
    }
  }
  const publicRoute = ['/api/portal/login', '/api/auth/connect', '/api/portal/session', '/api/portal/logout', '/api/university/diagnostics'].includes(path)
    || (path === '/api/resources' && request.method === 'GET');
  if (publicRoute) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  const { valid, userId } = await verifySessionCookie(request);

  if (!valid) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'SESSION_INVALID' },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Inject authenticated userId into request headers for downstream API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-user-id');
  if (userId) {
    requestHeaders.set('x-user-id', userId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
