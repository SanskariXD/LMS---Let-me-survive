import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  authToken: authToken,
});

export const db = drizzle(client, { schema });

// Auto-initialize tables if they do not exist
let initialized = false;

export async function ensureDbInitialized(): Promise<void> {
  if (initialized) return;

  try {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        enrollment_number TEXT NOT NULL UNIQUE,
        student_name TEXT NOT NULL,
        program_code TEXT,
        year_admitted INTEGER,
        pin_hash TEXT,
        university_password_encrypted TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS university_sessions (
        user_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        last_synced_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_error TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS university_cached_data (
        user_id TEXT PRIMARY KEY,
        attendance_json TEXT,
        timetable_json TEXT,
        marks_json TEXT,
        academics_json TEXT,
        semesters_json TEXT,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        course TEXT,
        professor TEXT,
        slot TEXT,
        description TEXT,
        deadline_date TEXT,
        deadline_time TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        is_assignment INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        submission_url TEXT,
        reminder_mins INTEGER DEFAULT 30,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        assignment_reminders INTEGER DEFAULT 1,
        todo_reminders INTEGER DEFAULT 1,
        browser_notifications INTEGER DEFAULT 1,
        default_reminder TEXT DEFAULT '30m',
        auto_refresh INTEGER DEFAULT 1,
        offline_cache INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'en',
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_manual_courses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        course_code TEXT NOT NULL,
        course_name TEXT NOT NULL,
        credits INTEGER DEFAULT 3,
        semester TEXT NOT NULL,
        component_type TEXT DEFAULT 'Theory',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        uploader_id TEXT NOT NULL,
        uploader_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        course TEXT NOT NULL,
        professor TEXT,
        slot TEXT,
        semester TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        is_open_book INTEGER DEFAULT 0,
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        file_mime_type TEXT,
        tags TEXT DEFAULT '[]',
        helpful_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resource_bookmarks (
        user_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        PRIMARY KEY (user_id, resource_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resource_votes (
        user_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        PRIMARY KEY (user_id, resource_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );
    `);
    initialized = true;
  } catch (error) {
    console.error('[DB] Initialization error:', error);
  }
}
