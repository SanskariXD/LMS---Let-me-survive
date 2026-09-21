import { eq, and, or, desc } from 'drizzle-orm';
import { db, ensureDbInitialized } from '@/db';
import * as schema from '@/db/schema';
import { randomUUID } from 'node:crypto';

// -------------------------------------------------------------
// USER OPERATIONS
// -------------------------------------------------------------

export async function getUserById(id: string) {
  await ensureDbInitialized();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] || null;
}

export async function getUserByEnrollment(enrollmentOrEmail: string) {
  await ensureDbInitialized();
  if (!enrollmentOrEmail) return null;
  const raw = enrollmentOrEmail.trim();
  const cleanEnrollment = raw.split('@')[0].trim();

  const rows = await db.select().from(schema.users).where(
    or(
      eq(schema.users.enrollment_number, cleanEnrollment),
      eq(schema.users.enrollment_number, raw),
      eq(schema.users.email, raw)
    )
  ).limit(1);
  return rows[0] || null;
}

export async function updateUserEmail(userId: string, email: string) {
  await ensureDbInitialized();
  await db.update(schema.users).set({
    email: email.trim(),
    updated_at: Date.now(),
  }).where(eq(schema.users.id, userId));
}

export async function upsertUser(data: {
  enrollmentNumber: string;
  studentName: string;
  email?: string;
  programCode?: string;
  yearAdmitted?: number;
  pinHash?: string;
  universityPasswordEncrypted?: string;
}) {
  await ensureDbInitialized();
  const existing = await getUserByEnrollment(data.enrollmentNumber);
  const now = Date.now();

  if (existing) {
    await db.update(schema.users).set({
      student_name: data.studentName,
      email: data.email || existing.email,
      program_code: data.programCode || existing.program_code,
      year_admitted: data.yearAdmitted || existing.year_admitted,
      pin_hash: data.pinHash !== undefined ? data.pinHash : existing.pin_hash,
      university_password_encrypted: data.universityPasswordEncrypted !== undefined ? data.universityPasswordEncrypted : existing.university_password_encrypted,
      updated_at: now,
    }).where(eq(schema.users.id, existing.id));

    return { ...existing, ...data, id: existing.id, updated_at: now };
  } else {
    const id = `usr_${randomUUID().replace(/-/g, '')}`;
    const newUser = {
      id,
      email: data.email || null,
      enrollment_number: data.enrollmentNumber.trim(),
      student_name: data.studentName,
      program_code: data.programCode || null,
      year_admitted: data.yearAdmitted || null,
      pin_hash: data.pinHash || null,
      university_password_encrypted: data.universityPasswordEncrypted || null,
      created_at: now,
      updated_at: now,
    };
    await db.insert(schema.users).values(newUser);
    return newUser;
  }
}

export async function updateUserPin(userId: string, pinHash: string) {
  await ensureDbInitialized();
  await db.update(schema.users).set({
    pin_hash: pinHash,
    updated_at: Date.now(),
  }).where(eq(schema.users.id, userId));
}

// -------------------------------------------------------------
// UNIVERSITY SESSION & CACHE
// -------------------------------------------------------------

export async function getUniversitySession(userId: string) {
  await ensureDbInitialized();
  const rows = await db.select().from(schema.universitySessions).where(eq(schema.universitySessions.user_id, userId)).limit(1);
  return rows[0] || null;
}

export async function saveUniversitySession(userId: string, token: string, expiresAt: number, status = 'active', lastError?: string) {
  await ensureDbInitialized();
  const existing = await getUniversitySession(userId);
  const now = Date.now();

  if (existing) {
    await db.update(schema.universitySessions).set({
      token,
      expires_at: expiresAt,
      last_synced_at: now,
      status,
      last_error: lastError || null,
    }).where(eq(schema.universitySessions.user_id, userId));
  } else {
    await db.insert(schema.universitySessions).values({
      user_id: userId,
      token,
      expires_at: expiresAt,
      last_synced_at: now,
      status,
      last_error: lastError || null,
    });
  }
}

export async function getUniversityCachedData(userId: string) {
  await ensureDbInitialized();
  const rows = await db.select().from(schema.universityCachedData).where(eq(schema.universityCachedData.user_id, userId)).limit(1);
  return rows[0] || null;
}

export async function saveUniversityCachedData(userId: string, data: {
  attendanceJson?: string;
  timetableJson?: string;
  marksJson?: string;
  academicsJson?: string;
  semestersJson?: string;
}) {
  await ensureDbInitialized();
  const existing = await getUniversityCachedData(userId);
  const now = Date.now();

  if (existing) {
    await db.update(schema.universityCachedData).set({
      ...data,
      updated_at: now,
    }).where(eq(schema.universityCachedData.user_id, userId));
  } else {
    await db.insert(schema.universityCachedData).values({
      user_id: userId,
      attendance_json: data.attendanceJson || null,
      timetable_json: data.timetableJson || null,
      marks_json: data.marksJson || null,
      academics_json: data.academicsJson || null,
      semesters_json: data.semestersJson || null,
      updated_at: now,
    });
  }
}

// -------------------------------------------------------------
// TASKS OPERATIONS
// -------------------------------------------------------------

export async function getUserTasks(userId: string) {
  await ensureDbInitialized();
  return db.select().from(schema.tasks).where(eq(schema.tasks.user_id, userId)).orderBy(desc(schema.tasks.created_at));
}

export async function createTask(userId: string, data: {
  id?: string;
  title: string;
  course?: string;
  professor?: string;
  slot?: string;
  description?: string;
  deadlineDate?: string;
  deadlineTime?: string;
  priority?: string;
  isAssignment?: boolean;
  completed?: boolean;
  submissionUrl?: string;
  reminderMins?: number;
}) {
  await ensureDbInitialized();
  const now = Date.now();
  const id = data.id || `task_${randomUUID().replace(/-/g, '')}`;

  const task = {
    id,
    user_id: userId,
    title: data.title,
    course: data.course || null,
    professor: data.professor || null,
    slot: data.slot || null,
    description: data.description || null,
    deadline_date: data.deadlineDate || null,
    deadline_time: data.deadlineTime || null,
    priority: data.priority || 'medium',
    is_assignment: !!data.isAssignment,
    completed: !!data.completed,
    submission_url: data.submissionUrl || null,
    reminder_mins: data.reminderMins ?? 30,
    created_at: now,
    updated_at: now,
  };

  await db.insert(schema.tasks).values(task);
  return task;
}

export async function updateTask(userId: string, taskId: string, data: Partial<{
  title: string;
  course: string;
  professor: string;
  slot: string;
  description: string;
  deadlineDate: string;
  deadlineTime: string;
  priority: string;
  isAssignment: boolean;
  completed: boolean;
  submissionUrl: string;
  reminderMins: number;
}>) {
  await ensureDbInitialized();
  const updates: Record<string, any> = { updated_at: Date.now() };

  if (data.title !== undefined) updates.title = data.title;
  if (data.course !== undefined) updates.course = data.course;
  if (data.professor !== undefined) updates.professor = data.professor;
  if (data.slot !== undefined) updates.slot = data.slot;
  if (data.description !== undefined) updates.description = data.description;
  if (data.deadlineDate !== undefined) updates.deadline_date = data.deadlineDate;
  if (data.deadlineTime !== undefined) updates.deadline_time = data.deadlineTime;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.isAssignment !== undefined) updates.is_assignment = data.isAssignment;
  if (data.completed !== undefined) updates.completed = data.completed;
  if (data.submissionUrl !== undefined) updates.submission_url = data.submissionUrl;
  if (data.reminderMins !== undefined) updates.reminder_mins = data.reminderMins;

  await db.update(schema.tasks)
    .set(updates)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.user_id, userId)));

  const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  return rows[0] || null;
}

export async function deleteTask(userId: string, taskId: string) {
  await ensureDbInitialized();
  await db.delete(schema.tasks).where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.user_id, userId)));
  return true;
}

// -------------------------------------------------------------
// USER PREFERENCES
// -------------------------------------------------------------

export async function getUserPreferences(userId: string) {
  await ensureDbInitialized();
  const rows = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.user_id, userId)).limit(1);
  return rows[0] || {
    user_id: userId,
    assignment_reminders: true,
    todo_reminders: true,
    browser_notifications: true,
    default_reminder: '30m',
    auto_refresh: true,
    offline_cache: true,
    theme: 'light',
    language: 'en',
    updated_at: Date.now(),
  };
}

export async function upsertUserPreferences(userId: string, data: Partial<{
  assignmentReminders: boolean;
  todoReminders: boolean;
  browserNotifications: boolean;
  defaultReminder: string;
  autoRefresh: boolean;
  offlineCache: boolean;
  theme: string;
  language: string;
}>) {
  await ensureDbInitialized();
  const existing = await getUserPreferences(userId);
  const now = Date.now();

  const updates: Record<string, any> = {
    updated_at: now,
  };

  if (data.assignmentReminders !== undefined) updates.assignment_reminders = data.assignmentReminders;
  if (data.todoReminders !== undefined) updates.todo_reminders = data.todoReminders;
  if (data.browserNotifications !== undefined) updates.browser_notifications = data.browserNotifications;
  if (data.defaultReminder !== undefined) updates.default_reminder = data.defaultReminder;
  if (data.autoRefresh !== undefined) updates.auto_refresh = data.autoRefresh;
  if (data.offlineCache !== undefined) updates.offline_cache = data.offlineCache;
  if (data.theme !== undefined) updates.theme = data.theme;
  if (data.language !== undefined) updates.language = data.language;

  const existingRow = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.user_id, userId)).limit(1);
  if (existingRow.length > 0) {
    await db.update(schema.userPreferences).set(updates).where(eq(schema.userPreferences.user_id, userId));
  } else {
    await db.insert(schema.userPreferences).values({
      user_id: userId,
      assignment_reminders: updates.assignment_reminders ?? true,
      todo_reminders: updates.todo_reminders ?? true,
      browser_notifications: updates.browser_notifications ?? true,
      default_reminder: updates.default_reminder ?? '30m',
      auto_refresh: updates.auto_refresh ?? true,
      offline_cache: updates.offline_cache ?? true,
      theme: updates.theme ?? 'light',
      language: updates.language ?? 'en',
      updated_at: now,
    });
  }

  return getUserPreferences(userId);
}

// -------------------------------------------------------------
// USER MANUAL COURSES
// -------------------------------------------------------------

export async function getUserManualCourses(userId: string) {
  await ensureDbInitialized();
  return db.select().from(schema.userManualCourses).where(eq(schema.userManualCourses.user_id, userId));
}

export async function addManualCourse(userId: string, data: {
  courseCode: string;
  courseName: string;
  credits?: number;
  semester: string;
  componentType?: string;
}) {
  await ensureDbInitialized();
  const id = `mc_${randomUUID().replace(/-/g, '')}`;
  const record = {
    id,
    user_id: userId,
    course_code: data.courseCode.trim().toUpperCase(),
    course_name: data.courseName.trim(),
    credits: data.credits || 3,
    semester: data.semester,
    component_type: data.componentType || 'Theory',
    created_at: Date.now(),
  };

  await db.insert(schema.userManualCourses).values(record);
  return record;
}

export async function deleteManualCourse(userId: string, courseId: string) {
  await ensureDbInitialized();
  await db.delete(schema.userManualCourses).where(
    and(eq(schema.userManualCourses.id, courseId), eq(schema.userManualCourses.user_id, userId))
  );
  return true;
}

// -------------------------------------------------------------
// RESOURCE HUB OPERATIONS
// -------------------------------------------------------------

export async function getResources(userId?: string) {
  await ensureDbInitialized();
  const list = await db.select().from(schema.resources).orderBy(desc(schema.resources.created_at));

  let userBookmarks = new Set<string>();
  let userVotes = new Set<string>();

  if (userId) {
    const bookmarks = await db.select().from(schema.resourceBookmarks).where(eq(schema.resourceBookmarks.user_id, userId));
    const votes = await db.select().from(schema.resourceVotes).where(eq(schema.resourceVotes.user_id, userId));
    bookmarks.forEach((b) => userBookmarks.add(b.resource_id));
    votes.forEach((v) => userVotes.add(v.resource_id));
  }

  return list.map((res) => ({
    ...res,
    isBookmarked: userBookmarks.has(res.id),
    hasVoted: userVotes.has(res.id),
  }));
}

export async function createResource(userId: string, uploaderName: string, data: {
  title: string;
  description?: string;
  course: string;
  professor?: string;
  slot?: string;
  semester: string;
  resourceType: string;
  isOpenBook?: boolean;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileMimeType?: string;
  tags?: string[];
}) {
  await ensureDbInitialized();
  const id = `res_${randomUUID().replace(/-/g, '')}`;
  const record = {
    id,
    uploader_id: userId,
    uploader_name: uploaderName,
    title: data.title,
    description: data.description || null,
    course: data.course,
    professor: data.professor || null,
    slot: data.slot || null,
    semester: data.semester,
    resource_type: data.resourceType,
    is_open_book: !!data.isOpenBook,
    file_url: data.fileUrl,
    file_name: data.fileName,
    file_size: data.fileSize || 0,
    file_mime_type: data.fileMimeType || null,
    tags: JSON.stringify(data.tags || []),
    helpful_count: 0,
    created_at: Date.now(),
  };

  await db.insert(schema.resources).values(record);
  return record;
}

export async function deleteResource(userId: string, resourceId: string) {
  await ensureDbInitialized();
  // Ensure user owns this resource before deletion
  await db.delete(schema.resources).where(
    and(eq(schema.resources.id, resourceId), eq(schema.resources.uploader_id, userId))
  );
  return true;
}

export async function toggleResourceVote(userId: string, resourceId: string) {
  await ensureDbInitialized();
  const existing = await db.select().from(schema.resourceVotes).where(
    and(eq(schema.resourceVotes.user_id, userId), eq(schema.resourceVotes.resource_id, resourceId))
  ).limit(1);

  const res = await db.select().from(schema.resources).where(eq(schema.resources.id, resourceId)).limit(1);
  if (!res[0]) return null;

  if (existing[0]) {
    await db.delete(schema.resourceVotes).where(
      and(eq(schema.resourceVotes.user_id, userId), eq(schema.resourceVotes.resource_id, resourceId))
    );
    const newCount = Math.max(0, (res[0].helpful_count || 1) - 1);
    await db.update(schema.resources).set({ helpful_count: newCount }).where(eq(schema.resources.id, resourceId));
    return { voted: false, count: newCount };
  } else {
    await db.insert(schema.resourceVotes).values({ user_id: userId, resource_id: resourceId });
    const newCount = (res[0].helpful_count || 0) + 1;
    await db.update(schema.resources).set({ helpful_count: newCount }).where(eq(schema.resources.id, resourceId));
    return { voted: true, count: newCount };
  }
}

export async function toggleResourceBookmark(userId: string, resourceId: string) {
  await ensureDbInitialized();
  const existing = await db.select().from(schema.resourceBookmarks).where(
    and(eq(schema.resourceBookmarks.user_id, userId), eq(schema.resourceBookmarks.resource_id, resourceId))
  ).limit(1);

  if (existing[0]) {
    await db.delete(schema.resourceBookmarks).where(
      and(eq(schema.resourceBookmarks.user_id, userId), eq(schema.resourceBookmarks.resource_id, resourceId))
    );
    return { bookmarked: false };
  } else {
    await db.insert(schema.resourceBookmarks).values({ user_id: userId, resource_id: resourceId });
    return { bookmarked: true };
  }
}
