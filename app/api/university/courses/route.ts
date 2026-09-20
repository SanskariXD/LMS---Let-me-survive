import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export async function GET() {
  try {
    const data = await universityRequest(UNIVERSITY_ENDPOINTS.courses);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Courses endpoint is not available', code: 'COURSES_UNAVAILABLE' },
      { status: 502 },
    );
  }
}
