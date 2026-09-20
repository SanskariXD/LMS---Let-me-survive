import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { updateTask, deleteTask } from '@/lib/db/queries';

export async function PATCH(
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
    const body = await request.json();

    const updated = await updateTask(userId, id, {
      title: body.title,
      course: body.course,
      professor: body.professor,
      slot: body.slot,
      description: body.description,
      deadlineDate: body.deadlineDate || body.deadline_date,
      deadlineTime: body.deadlineTime || body.deadline_time,
      priority: body.priority,
      isAssignment: body.isAssignment ?? body.is_assignment,
      completed: body.completed,
      submissionUrl: body.submissionUrl || body.submission_url,
      reminderMins: body.reminderMins ?? body.reminder_mins,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Task not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ task: updated });
  } catch (error: any) {
    console.error('[TasksAPI] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

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
    await deleteTask(userId, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TasksAPI] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
