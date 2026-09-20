import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'slotwise_session';

export const config = {
  matcher: ['/portal/:path+', '/api/university/:path*', '/api/tasks/:path*', '/api/resources/:path*', '/api/user/:path*', '/api/sync/:path*'],
};

async function verifySessionCookie(request: NextRequest): Promise<{ valid: boolean; userId?: string }> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return { valid: false };

  const secret = process.env.SESSION_SECRET || 'slotwise-dev-fallback-secret-for-session-signing-at-least-32-chars';

  try {
    const [payload, signature] = cookie.value.split('.');
    if (!payload || !signature) return { valid: false };

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
  // Allow university diagnostics to be checked publicly for health checks
  if (request.nextUrl.pathname === '/api/university/diagnostics') {
    return NextResponse.next();
  }

  // Allow public resource listing/viewing
  if (request.nextUrl.pathname === '/api/resources' && request.method === 'GET') {
    return NextResponse.next();
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
  if (userId) {
    requestHeaders.set('x-user-id', userId);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
