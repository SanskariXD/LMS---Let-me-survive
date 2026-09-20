<USER_REQUEST>
from pathlib import Path

md = """# LMS² — Backend, Multi-User Storage, Vercel Deployment & Migration Brief

## Objective

Complete the production backend for **LMS²** and prepare the existing portal for real multi-user use.

The application will be hosted on **Vercel**. The backend, persistent storage, authentication/session handling, file storage, user-specific data, sync logic and deployment configuration must therefore be made production-ready for that environment.

Do **not** redesign or rebuild working frontend features unnecessarily.

Before making changes, inspect the existing architecture, current data flow, existing API routes, authentication logic, local-storage usage, university API integration and all already-built portal features.

The goal is to migrate the current mostly local/single-user implementation into a proper persistent **multi-user system** without breaking existing functionality.

---

# 1. Start With a Full Project Audit

Before modifying anything:

- Inspect the complete current project.
- Identify every existing page, feature, API route and data source.
- Identify all places currently using:
  - localStorage
  - sessionStorage
  - mock data
  - hardcoded student data
  - hardcoded user names
  - hardcoded IDs
  - temporary frontend-only data
  - static JSON
  - browser-only authentication/session state
- Identify all data currently received from the university API.
- Identify all user-created data.
- Identify existing caching/offline logic.
- Identify existing login/session/PIN logic.
- Identify the current Resource Hub implementation.
- Identify existing task/reminder functionality.
- Identify current mobile/PWA support.

Do not begin a large rewrite until the current implementation is mapped.

---

# 2. Create a Migration Checklist

Create a clear internal TODO/checklist before implementation.

Track every feature individually and mark:

- Existing state
- Required backend work
- Migration required
- Multi-user conversion required
- Offline/cache changes required
- Testing completed
- Production-ready

Do not consider the migration complete until every existing feature has been reviewed.

At minimum, include:

- Authentication
- User profiles
- University account connection
- PIN / quick unlock
- Dashboard
- Attendance
- Marks
- Timetable
- Academics
- Tasks
- Assignments
- Task reminders
- Resource Hub
- Uploaded resources/files
- Saved/bookmarked resources if present
- Profile preferences
- Notification preferences
- Offline mode
- University-data cache
- University API proxy
- Slotwise Planner
- Mobile layout
- PWA/installability
- Logout
- User switching
- Account/session security
- Production deployment
- Migration verification

Maintain this checklist during the work instead of treating migration as one large task.

---

# 3. Multi-User Backend

Convert the portal from a personal/single-user system into a proper multi-user system.

Every user must have their own isolated data.

A logged-in user must only be able to access:

- Their own profile
- Their own university connection
- Their own university data/cache
- Their own tasks
- Their own assignments
- Their own reminders
- Their own preferences
- Their own saved/bookmarked resources
- Their own private data

Shared Resource Hub content may be visible to other users where intended.

There must be no possibility of one student receiving another student's private data because of:

- reused local-storage keys
- shared cache keys
- missing ownership checks
- API request manipulation
- browser switching
- stale sessions
- hardcoded IDs

All persistent records must have clear ownership or sharing scope.

---

# 4. Production Persistent Storage

Replace temporary/local-only storage where appropriate with proper persistent backend storage suitable for the Vercel production environment.

The production system must persist important user-generated data across:

- refreshes
- logouts/logins
- browsers
- devices
- deployments
- Vercel function restarts

Persistent backend storage is required for:

- LMS² user accounts
- user profiles
- account preferences
- task data
- assignment data
- reminder configuration
- Resource Hub metadata
- shared resources
- file ownership
- bookmarks/saves if present
- notification preferences
- university connection metadata where appropriate
- sync metadata
- other user-created portal data

Do not rely on server filesystem storage because deployments/functions are not permanent storage.

Use production storage that is appropriate for Vercel and the existing project architecture.

---

# 5. Local Storage Must Become Cache, Not the Main Database

Do not remove local storage blindly.

Reclassify local/browser storage into one of these purposes:

### Allowed Local Uses

- Offline cache
- PWA cache
- recently viewed data
- temporary UI state
- local preferences where appropriate
- last synchronized university data
- device-specific quick-unlock state where secure
- temporary unsynced actions

### Must Be Persisted Server-Side

- user account data
- tasks
- assignments
- persistent reminders
- Resource Hub records
- resource ownership
- shared content
- user profile/preferences that should follow the user
- any data that must survive browser/device changes

Make sure old local-only data is migrated where possible instead of simply disappearing.

---

# 6. Existing User Data Migration

Build a safe migration path from the current implementation.

If the current browser already contains:

- tasks
- assignments
- preferences
- profile settings
- cached data
- Resource Hub drafts
- other local records

then after the user signs into the new backend system:

1. Detect compatible legacy local data.
2. Associate it with the correct authenticated user.
3. Import it once.
4. Verify successful import.
5. Prevent duplicate migration.
6. Keep a migration marker/version.
7. Do not delete the local copy until the server copy is confirmed.
8. Avoid overwriting newer server data with stale browser data.

Migration should be versioned so future schema changes can also be handled safely.

---

# 7. Authentication & User Accounts

Create proper LMS² user identity/session handling.

The portal will be used by multiple students.

Users must have their own LMS² identity even though university data comes from the university system.

Support a first-time setup flow where a student connects their university account.

After setup, support convenient returning-user access.

Do not require the student to repeatedly enter their university credentials if an existing valid university session/token can still be used safely.

If the university session expires, the student can reconnect their university account without losing their LMS² data.

---

# 8. PIN / Quick Unlock

Support a user-created PIN for quick access on a trusted device.

The PIN is a **quick unlock mechanism for LMS²**, not the primary identity of the user and not a replacement for proper account/session security.

Requirements:

- User chooses their own PIN.
- PIN is associated with the correct LMS² user/device/session.
- Never store the PIN in plain text.
- Never expose the PIN through API responses.
- Do not use the PIN as a shortcut to expose stored university passwords.
- Allow users to change/remove the PIN.
- Provide a fallback to full sign-in/reconnect.
- Logging out properly must disable quick access to protected data.
- Switching users must not reuse the previous user's unlocked state.

Prepare the structure so biometric/passkey unlock can be added later if desired.

---

# 9. University API Integration

Preserve the university API integration, but make it production-safe.

The public browser must not directly depend on the university HTTP server.

Keep university API requests behind the application's server-side backend/proxy layer.

Because the university API has India-origin restrictions, make sure the deployed university-connection path uses the appropriate Vercel server region/configuration required for Indian-origin requests.

Do not assume the current deployment is correct.

Add proper diagnostics and verify the deployed production path.

For the university connection, verify:

- login
- authentication token forwarding
- semesters
- attendance
- timetable
- courses
- academics
- marks if supported
- profile
- logout
- any other currently implemented university endpoint

The deployed app must be tested against the real university API.

Do not expose low-level university API errors directly to students.

---

# 10. University API Diagnostics

Add production-safe diagnostics for maintainers.

We need to be able to distinguish:

- upstream reached successfully
- authentication failure
- geographic/IP rejection
- timeout
- malformed response
- server unavailable
- application-side proxy error

Do not expose sensitive tokens, passwords or private student data in logs.

Production logs must be useful enough to diagnose why a university request failed.

---

# 11. Offline / Cached University Data

Keep the previously planned offline behaviour.

The university API may normally be unavailable after approximately **5:00 PM** and return around **9:10 AM**.

When live university data cannot be loaded:

- show the latest successfully saved university data
- keep the portal usable
- do not clear existing cached data
- do not replace good cached data with empty/error responses
- do not display technical API errors to students

Show a simple status message such as:

> University services are currently offline. Showing your last saved data.

Also show the last successful refresh time.

When live university data becomes available:

- refresh the cached university data
- update the visible UI
- update the last-sync time
- remove the offline indicator
- do not require a complete application reload

Cached university data must be scoped to the correct student.

---

# 12. Tasks & Assignments

Move Tasks into the production backend.

Support:

- assignments
- normal to-dos
- deadlines
- priority
- notes
- course relation
- professor relation
- slot relation
- completion state
- reminders
- categories
- submission links
- created/updated timestamps

Tasks must follow the authenticated user across devices.

Offline-created/edited tasks should not silently disappear.

If offline editing is supported, synchronize changes once connectivity returns.

Prevent duplicate tasks during sync.

---

# 13. Reminders

Make reminder data persistent per user.

The current frontend/browser notification experience can remain, but reminder records themselves should belong to the user and survive device/browser changes where appropriate.

Keep notification preferences separate per user.

Do not claim that browser notifications will always work when the browser is closed unless a supported push-notification system is actually implemented.

Keep the system ready for future push notifications.

---

# 14. Resource Hub Backend

Upgrade Resource Hub from UI-only/mock data to persistent shared storage.

Resource Hub must support real users and real ownership.

Each resource should know:

- uploader/user
- title
- description
- course
- professor
- slot
- semester
- resource type
- file metadata
- upload date
- tags
- visibility/status if needed

Resource types include:

- Class Notes
- Assignment
- Assignment Reference
- Open Book Notes
- Study Material
- Lab Material
- Previous Questions
- Reference Material
- Other

Shared resources must be visible to the appropriate users.

Do not mix private task attachments with publicly/shared Resource Hub content.

---

# 15. Resource File Storage

Add proper persistent file storage for Resource Hub uploads.

Do not store uploaded files in the application filesystem.

The storage must work properly in production on Vercel.

Support appropriate academic file types such as:

- PDF
- DOC/DOCX
- PPT/PPTX
- XLS/XLSX
- images
- text files
- other sensible course-resource formats

Add reasonable:

- file size restrictions
- file type validation
- upload ownership
- deletion permissions
- metadata
- error handling

A user must not be able to delete another user's uploaded resource unless moderation/admin rules explicitly allow it.

---

# 16. Profile & Preferences

Move persistent user preferences to the backend where they should follow the user across devices.

Include:

- profile information
- display preferences
- default task reminder
- notification settings
- Resource Hub settings if present
- theme preference if applicable

University-provided profile fields should remain clearly distinguished from LMS²-controlled fields.

---

# 17. Dashboard

Review the Dashboard after backend migration.

Make sure all cards/widgets use the correct authenticated user's data.

Verify:

- today's schedule
- attendance overview
- upcoming deadlines
- quick actions
- marks
- academic data
- user greeting
- reality-check content if retained

Remove remaining hardcoded personal data.

---

# 18. Slotwise Planner

Do not break the existing Slotwise Planner.

Review whether it contains any user-specific saved data.

If users can save:

- selected courses
- professor preferences
- generated timetables
- locked slots
- configurations

decide which of those should persist to the authenticated user's backend account.

Keep temporary generated combinations local if they do not need permanent storage.

---

# 19. Mobile & PWA

Make the complete portal mobile-compatible.

Review every page at mobile widths:

- Dashboard
- Attendance
- Marks
- Timetable
- Academics
- Tasks
- Resource Hub
- Profile
- Slotwise Planner
- Login/setup
- PIN unlock

Prepare LMS² as an installable PWA.

Use the LMS² branding/icon.

PWA requirements should include:

- installable app metadata
- correct app name
- correct icons
- responsive standalone experience
- offline application shell where appropriate
- cached read access where appropriate
- safe update behaviour

Do not let PWA cache cause users to see another user's information.

---

# 20. Data Synchronization

Clearly separate:

### LMS² Data

Owned and stored by LMS².

Examples:

- tasks
- reminders
- profile settings
- resource uploads
- bookmarks

### University Data

Owned by the university and synchronized/cached by LMS².

Examples:

- attendance
- timetable
- marks
- courses
- student profile
- semesters
- academic credits

Never treat cached university data as the authoritative source when fresh university data is available.

---

# 21. Logout & User Switching

Logout must be properly handled.

On logout:

- end LMS² session
- stop access to private backend data
- stop access to protected cached data
- disable quick unlock where required
- prevent browser back-navigation from revealing protected content
- ensure another user cannot inherit the previous user's university cache

Support safe account switching if multiple students use the same device/browser.

---

# 22. Security Review

Before production release, review:

- authentication
- authorization
- ownership checks
- server-side input validation
- file upload validation
- session handling
- PIN handling
- university tokens
- secrets/environment variables
- protected routes
- API access
- cross-user data leakage
- resource deletion permissions
- cache separation

Never expose:

- database credentials
- private API secrets
- university passwords
- raw auth tokens
- internal environment variables

in the frontend bundle.

---

# 23. Vercel Production Requirements

The entire production setup must be compatible with Vercel.

Review:

- server routes/functions
- persistent storage
- file storage
- environment variables
- university API proxy
- function region configuration
- build configuration
- runtime limitations
- production logs
- deployment behaviour
- preview vs production environments

Do not assume the local development environment behaves identically to Vercel.

Test the deployed application itself.

---

# 24. Environment Separation

Keep environments separated.

At minimum:

- local development
- Vercel preview/testing
- Vercel production

Do not allow test data to pollute production student data.

Production secrets must not be committed to the repository.

---

# 25. Migration Safety

Do not perform a destructive rewrite.

Preserve working frontend behaviour while migrating backend services feature-by-feature.

Recommended migration process:

1. Audit existing feature.
2. Identify current storage/data source.
3. Add new persistent backend support.
4. Add authenticated ownership.
5. Migrate existing data if needed.
6. Test with one user.
7. Test with a second completely separate user.
8. Verify no cross-user leakage.
9. Verify refresh/device persistence.
10. Verify offline fallback if relevant.
11. Mark feature complete in migration checklist.
12. Continue to next feature.

---

# 26. Multi-User Testing

Before declaring the system finished, create at least two completely separate test users.

Verify that:

### User A

- sees only User A tasks
- sees User A university data
- gets User A cached data
- has User A PIN/preferences
- owns User A Resource Hub uploads

### User B

- sees only User B tasks
- sees User B university data
- gets User B cached data
- has User B PIN/preferences
- owns User B Resource Hub uploads

Shared Resource Hub content may be visible to both as designed.

Test:

- separate browsers
- same browser after logout/login
- mobile view
- installed PWA
- refresh
- deployment update
- university API unavailable
- university API reconnect
- expired university session

---

# 27. Final Production Validation

Do not mark the backend migration complete until all of the following are verified:

- Production deployment works on Vercel.
- Persistent data survives deployments.
- Multiple users work independently.
- No cross-user leakage exists.
- University API integration works from production.
- University API failure falls back cleanly to cache.
- Tasks persist across devices.
- Resource Hub uploads persist.
- Profile/preferences persist.
- PIN quick unlock behaves safely.
- Logout is secure.
- Mobile layouts work.
- PWA installs successfully.
- Offline mode works.
- Existing Slotwise functionality still works.
- Existing portal pages still work.
- All migration TODO items are checked.

---

# 28. Deliverables

At the end of the work, provide:

1. A completed migration checklist.
2. A summary of backend services/storage now in use.
3. A list of environment variables required for production.
4. Any remaining manual Vercel configuration required.
5. Migration notes for existing local users/data.
6. Known limitations.
7. Confirmation of multi-user isolation testing.
8. Confirmation of production university API testing.
9. Confirmation of PWA/mobile testing.
10. A concise list of anything still intentionally left for a future phase.

Do not simply say the backend is complete.

Verify every existing feature against the checklist first.
"""

path = Path("/mnt/data/LMS2_BACKEND_VERCEL_MIGRATION_BRIEF.md")
path.write_text(md, encoding="utf-8")
print(path)

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-20T23:21:12+05:30.
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.6 Flash (Low) to Gemini 3.8 Flash (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>