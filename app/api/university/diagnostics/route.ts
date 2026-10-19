import { NextResponse } from 'next/server';

// Public liveness only: do not probe upstream services or expose cross-account logs.
export async function GET() {
  return NextResponse.json({status: 'ok'}, {headers: {'Cache-Control': 'no-store'}});
}
