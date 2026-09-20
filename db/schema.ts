import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  enrollment_number: text('enrollment_number').notNull().unique(),
  student_name: text('student_name').notNull(),
  program_code: text('program_code'),
  year_admitted: integer('year_admitted'),
  pin_hash: text('pin_hash'), // scrypt hash `salt:hash`
  university_password_encrypted: text('university_password_encrypted'), // AES-256-GCM
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const universitySessions = sqliteTable('university_sessions', {
  user_id: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expires_at: integer('expires_at').notNull(),
  last_synced_at: integer('last_synced_at').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'offline' | 'expired'
  last_error: text('last_error'),
});

export const universityCachedData = sqliteTable('university_cached_data', {
  user_id: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  attendance_json: text('attendance_json'),
  timetable_json: text('timetable_json'),
  marks_json: text('marks_json'),
  academics_json: text('academics_json'),
  semesters_json: text('semesters_json'),
  updated_at: integer('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  course: text('course'),
  professor: text('professor'),
  slot: text('slot'),
  description: text('description'),
  deadline_date: text('deadline_date'),
  deadline_time: text('deadline_time'),
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high'
  is_assignment: integer('is_assignment', { mode: 'boolean' }).notNull().default(false),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  submission_url: text('submission_url'),
  reminder_mins: integer('reminder_mins').default(30),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const userPreferences = sqliteTable('user_preferences', {
  user_id: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  assignment_reminders: integer('assignment_reminders', { mode: 'boolean' }).default(true),
  todo_reminders: integer('todo_reminders', { mode: 'boolean' }).default(true),
  browser_notifications: integer('browser_notifications', { mode: 'boolean' }).default(true),
  default_reminder: text('default_reminder').default('30m'),
  auto_refresh: integer('auto_refresh', { mode: 'boolean' }).default(true),
  offline_cache: integer('offline_cache', { mode: 'boolean' }).default(true),
  theme: text('theme').default('light'),
  language: text('language').default('en'),
  updated_at: integer('updated_at').notNull(),
});

export const userManualCourses = sqliteTable('user_manual_courses', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  course_code: text('course_code').notNull(),
  course_name: text('course_name').notNull(),
  credits: integer('credits').default(3),
  semester: text('semester').notNull(),
  component_type: text('component_type').default('Theory'),
  created_at: integer('created_at').notNull(),
});

export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  uploader_id: text('uploader_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  uploader_name: text('uploader_name').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  course: text('course').notNull(),
  professor: text('professor'),
  slot: text('slot'),
  semester: text('semester').notNull(),
  resource_type: text('resource_type').notNull(),
  is_open_book: integer('is_open_book', { mode: 'boolean' }).default(false),
  file_url: text('file_url').notNull(),
  file_name: text('file_name').notNull(),
  file_size: integer('file_size').default(0),
  file_mime_type: text('file_mime_type'),
  tags: text('tags').default('[]'),
  helpful_count: integer('helpful_count').default(0),
  created_at: integer('created_at').notNull(),
});

export const resourceBookmarks = sqliteTable('resource_bookmarks', {
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resource_id: text('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.resource_id] }),
]);

export const resourceVotes = sqliteTable('resource_votes', {
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resource_id: text('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.resource_id] }),
]);
