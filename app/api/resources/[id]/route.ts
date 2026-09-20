import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { deleteResource } from '@/lib/db/queries';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    await deleteResource(userId, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ResourcesAPI] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
