import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import {
  getUserTasks,
  createTask,
  getUserManualCourses,
  addManualCourse,
  upsertUserPreferences,
  createResource,
  getUserById,
} from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(userId);
    const uploaderName = user?.student_name || session?.name || 'Student';

    const body = await request.json();
    const { tasks, manualCourses, preferences, sharedResources } = body;

    let importedTasks = 0;
    let importedCourses = 0;
    let importedResources = 0;

    // 1. Migrate legacy tasks
    if (Array.isArray(tasks) && tasks.length > 0) {
      const existingTasks = await getUserTasks(userId);
      const existingIds = new Set(existingTasks.map((t) => t.id));
      const existingTitles = new Set(existingTasks.map((t) => t.title.toLowerCase().trim()));

      for (const t of tasks) {
        if (!t?.title) continue;
        const normalizedTitle = t.title.toLowerCase().trim();
        if (t.id && existingIds.has(t.id)) continue;
        if (existingTitles.has(normalizedTitle)) continue;

        await createTask(userId, {
          id: t.id,
          title: t.title,
          course: t.course,
          professor: t.professor,
          slot: t.slot,
          description: t.description,
          deadlineDate: t.deadlineDate || t.deadline_date,
          deadlineTime: t.deadlineTime || t.deadline_time,
          priority: t.priority,
          isAssignment: t.isAssignment ?? t.is_assignment,
          completed: t.completed,
          submissionUrl: t.submissionUrl || t.submission_url,
          reminderMins: t.reminderMins ?? t.reminder_mins,
        });
        importedTasks++;
      }
    }

    // 2. Migrate legacy manual courses
    if (Array.isArray(manualCourses) && manualCourses.length > 0) {
      const existingCourses = await getUserManualCourses(userId);
      const existingKeys = new Set(existingCourses.map((c) => `${c.course_code}|${c.semester}`));

      for (const c of manualCourses) {
        if (!c?.courseCode || !c?.courseName || !c?.semester) continue;
        const key = `${c.courseCode.toUpperCase()}|${c.semester}`;
        if (existingKeys.has(key)) continue;

        await addManualCourse(userId, {
          courseCode: c.courseCode,
          courseName: c.courseName,
          credits: c.credits,
          semester: c.semester,
          componentType: c.componentType,
        });
        importedCourses++;
      }
    }

    // 3. Migrate preferences
    if (preferences && typeof preferences === 'object') {
      await upsertUserPreferences(userId, {
        assignmentReminders: preferences.assignmentReminders,
        todoReminders: preferences.todoReminders,
        browserNotifications: preferences.browserNotifications,
        defaultReminder: preferences.defaultReminder,
        autoRefresh: preferences.autoRefresh,
        offlineCache: preferences.offlineCache,
        theme: preferences.theme,
        language: preferences.language,
      });
    }

    // 4. Migrate custom shared resources
    if (Array.isArray(sharedResources) && sharedResources.length > 0) {
      for (const r of sharedResources) {
        if (!r?.title || !r?.course || !r?.fileUrl) continue;
        await createResource(userId, uploaderName, {
          title: r.title,
          description: r.description,
          course: r.course,
          professor: r.professor,
          slot: r.slot,
          semester: r.semester || 'Current',
          resourceType: r.resourceType || r.type || 'Class Notes',
          isOpenBook: r.isOpenBook,
          fileUrl: r.fileUrl,
          fileName: r.fileName || 'document',
          fileSize: r.fileSize || 0,
        });
        importedResources++;
      }
    }

    return NextResponse.json({
      success: true,
      version: 'v1',
      imported: {
        tasks: importedTasks,
        courses: importedCourses,
        resources: importedResources,
      },
    });
  } catch (error: any) {
    console.error('[MigrateAPI] Error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
