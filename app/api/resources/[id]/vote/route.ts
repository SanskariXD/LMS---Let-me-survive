import { guardMutation } from '@/lib/security/request';
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { toggleResourceVote } from '@/lib/db/queries';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await toggleResourceVote(userId, id);

    if (!result) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[ResourcesAPI] Vote error:', error);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
