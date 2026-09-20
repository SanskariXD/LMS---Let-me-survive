import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeSemesters } from '@/lib/university/normalize';

export async function GET() {
  try {
    const data = await universityRequest<unknown>(UNIVERSITY_ENDPOINTS.semesters);
    const semesters = normalizeSemesters(data);
    return NextResponse.json({ semesters });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch semesters' },
      { status: 502 },
    );
  }
}
