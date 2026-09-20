import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await getUserPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('[PreferencesAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updated = await upsertUserPreferences(userId, {
      assignmentReminders: body.assignmentReminders,
      todoReminders: body.todoReminders,
      browserNotifications: body.browserNotifications,
      defaultReminder: body.defaultReminder,
      autoRefresh: body.autoRefresh,
      offlineCache: body.offlineCache,
      theme: body.theme,
      language: body.language,
    });

    return NextResponse.json({ preferences: updated });
  } catch (error: any) {
    console.error('[PreferencesAPI] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
