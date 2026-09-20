import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export async function GET() {
  try {
    const data = await universityRequest(UNIVERSITY_ENDPOINTS.registrationStatus);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration status unavailable' },
      { status: 502 },
    );
  }
}
