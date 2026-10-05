# Course registration: Slotwise → LMS²

## Student flow

1. Open Course Registration, choose the academic year and semester (Fall 2026–27 by default), then open Slotwise.
2. Select courses and sections. Slotwise attempts to refresh each selected course using official offerings. Use **Load official** with a course code to add missing courses or refresh outdated sections. Generate the timetable and choose **Use this timetable**. Only courses in that displayed option are exported.
3. The LMS list is read-only. Official venue and faculty lookups start automatically in groups of four. Unavailable or ambiguous details show a red badge with a reason. Edit the timetable inside Slotwise.
4. Confirm the account and selected timetable, then choose Register. Live registration status and existing registrations are checked. For each course, a fresh offerings GET resolves its venue and faculty immediately before its registration POST. Courses run sequentially without waiting for every course's offerings first.
5. Follow per-course results. An unresolved course sends no registration request, and the next course can continue. Explicitly retry blocked or rejected courses. An uncertain response stops the queue and must be checked in the university timetable.

## Official offerings and term handling

The authenticated server performs GET `/api/course-registration/course-offerings/{course_code}/{slot_year}/{semester_type}`. Tokens stay on the server. The lookup is a same-origin POST from the browser only to support session/origin checks; the upstream university operation is a GET.

The provided response has `course_info` and `offerings`, with `slots_offered`, `venue`, `faculty_name` and optional `available_seats`. The resolver verifies the course code on the response and every offering, checks course type, then matches the selected slot exactly. A unique offering corrects outdated catalogue faculty spelling. Multiple offerings for the same slot require one unique faculty match; rooms are never chosen arbitrarily. Theory and practical selections resolve separately into their respective fields. Missing rooms/names, zero or unverified seat counts, type mismatches and unknown formats block that course.

The year and semester are validated and carried with the exported plan, upstream offerings URL, timetable check, registration payload and durable attempt key. Selecting Winter switches all these together. The bundled Fall 2026–27 catalogue is not used for other terms; those terms require loading official courses by code.

Official planner entries use recognised explicit slot strings. Existing theory/lab links can be refreshed; a new combined course with multiple sections is not cross-paired without verified linkage. Unsupported combined response formats require an official response example before adding a parser. The supplied theory-only response is supported. Course-level listings and semester offerings cannot be inferred when the university endpoint is unavailable.

## Architecture and safeguards

- Slotwise exports versioned, account-bound data using same-origin storage and an exact-origin iframe message. No credential is exported. The parent checks both origin and iframe source.
- `payload.ts` validates selection intent, duplicates, course codes, supported slots and clashes using the same planner engine. Four payload shapes are supported: theory + lab, lab only, theory only and project. Combined lab pairs beyond one adjacent pair are blocked pending a verified payload format.
- `/resolve` performs read-only background lookups. `/offerings` supplies official planner data. Both require the signed session, matching Origin, bounded request size and strict input schemas.
- `/prepare` validates and stores immutable, account-bound slot/faculty intent for ten minutes, including the selected term. It checks the live enabled flag and existing timetable. Its pending metadata placeholders are never sent to the university.
- `/execute` accepts only planId, courseCode and an optional explicit retryRejected flag. It uses the saved intent and a fresh official lookup, rather than a client-supplied payload, endpoint, token or user ID.
- Account-wide database locks serialize requests across tabs and instances. Existing registered course codes are skipped regardless of section; no delete, withdrawal, replacement or capacity modification exists in this flow.
- The current account's bearer token is attached server-side to exactly one fixed `/api/course-registration/register` POST. Redirects and automatic mutation retries are disabled. A durable pending marker is written before sending, with a unique user/term/course key.
- Successful, pending and uncertain attempts cannot be automatically resent. Only confirmed rejection can be explicitly retried. A blocked lookup has sent nothing and may be retried.
- Timeouts, crashes, ambiguous 2xx and 5xx responses are uncertain. Check the university timetable before attempting more registrations. On a subsequent live check, a present course is safely skipped.
- Stop and page navigation stop the remaining queue after the active course; they do not cancel a POST already sent.
- Vercel requires the existing persistent Turso/LibSQL database; the ephemeral file fallback cannot authorize registration. Routes use the existing Mumbai region and avoid browser mixed-content requests.

## Verification and limits

Run `npm run test:registration` and `npm run build`. Tests use mock university responses and isolated SQLite, covering official metadata matching, separate theory/lab rooms, ambiguous offerings, missing rooms, seat checks, Winter URLs and payloads, term-isolated attempts, blocked lookups, immutable intent, account locks and timeout handling.

University registration availability, seat capacity, prerequisites, credit limits and eligibility remain authoritative. The live status parser requires `{enabled:true}`; timetable responses require recognised registration arrays and course codes. Unknown structures fail closed. No live university course registration was performed while implementing or testing this feature.
