import { NextResponse } from 'next/server';
import { universityConfig } from '@/lib/university/config';
import { getDiagnostics } from '@/lib/university/logger';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export const preferredRegion = 'bom1';

export async function GET() {
  const started = Date.now();
  let upstreamReachable = false;
  let latencyMs = 0;
  let upstreamStatus = 0;

  try {
    const probe = await fetch(`${universityConfig.baseUrl}${UNIVERSITY_ENDPOINTS.login}`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(3000),
    });
    upstreamReachable = true;
    upstreamStatus = probe.status;
    latencyMs = Date.now() - started;
  } catch (err) {
    latencyMs = Date.now() - started;
  }

  // Calculate IST hours
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 3600000 * 5.5);
  const istHours = istTime.getHours();
  const istMinutes = istTime.getMinutes();
  const isDowntimePeriod =
    (istHours > 17 || (istHours === 17 && istMinutes >= 0)) ||
    (istHours < 9 || (istHours === 9 && istMinutes < 10));

  return NextResponse.json({
    status: upstreamReachable ? 'online' : 'offline',
    upstream: {
      url: universityConfig.baseUrl,
      reachable: upstreamReachable,
      httpStatus: upstreamStatus,
      latency: `${latencyMs}ms`,
    },
    timing: {
      serverTimeUtc: now.toISOString(),
      serverTimeIst: istTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      isDowntimePeriod,
      downtimeSchedule: '5:00 PM - 9:10 AM IST daily',
    },
    vercel: {
      configuredRegion: 'bom1 (Mumbai, India)',
      clientIpRestricted: 'India Only',
    },
    recentLogs: getDiagnostics().slice(0, 15),
  });
}
