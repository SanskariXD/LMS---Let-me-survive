import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';
import { updateUserEmail } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id') || undefined;
    const data = await universityRequest<any>(UNIVERSITY_ENDPOINTS.me, { userId });
    
    if (userId && (data?.email || data?.user?.email)) {
      const email = data.email || data.user.email;
      updateUserEmail(userId, email).catch(() => {});
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 502 },
    );
  }
}
