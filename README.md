# Sanskari Student Space

Private personal university portal with Slotwise at `/slotwise/index.html`.

## Current phase
- Overview, semester-based attendance, computed attendance targets, and course names from attendance records.
- Server-only university requests through `/api/university/[action]`.
- Student login and documented fallback; university JWT held in a secure HttpOnly cookie, never returned to the client. Passwords are not stored.
- Official timetable, course registration/curriculum, assignments and personal tasks remain future phases. No invented university endpoints or example student records are displayed.

## Integration status
Endpoint contracts were supplied by the owner. The upstream HTTP server did not respond during development. Sign-in and live data have not been verified. Mocked contract/security checks and attendance calculations passed. UI browser QA was blocked by the preview environment.

University HTTP transport is disclosed before sign-in. `/auth/me` is intentionally unused because its authentication header was not confirmed. Student profiles are requested only when the university token contains an enrollment field; numeric IDs are never substituted. The private Sites access policy protects the portal and server routes check platform identity.

## Development
Use the Sites setup, preview, build and hosting workflows with the retained pnpm lockfile. Source lives in `app`, `lib`, and `public/slotwise`. Never add passwords, tokens or response dumps to source control.
