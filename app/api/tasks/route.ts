import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserTasks, createTask } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await getUserTasks(userId);
    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('[TasksAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body?.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const task = await createTask(userId, {
      id: body.id,
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

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    console.error('[TasksAPI] POST error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
