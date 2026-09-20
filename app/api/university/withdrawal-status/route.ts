import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id') || undefined;
    const data = await universityRequest(UNIVERSITY_ENDPOINTS.withdrawalStatus, { userId });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Withdrawal status unavailable' },
      { status: 502 },
    );
  }
}
