# Course registration: Slotwise → LMS²

## Student flow

1. Open **Course Registration** in the LMS² side navigation.
2. Open Slotwise, generate options and choose **Use this timetable** on the final option. Only courses actually included in that option are exported.
3. Verify one exact course code per row, the course type, slots, separate theory/lab venues, and exact official faculty names. Missing information is not invented. The static catalogue is a planning aid, not a live seat catalogue.
4. Select the courses to add, then choose **Review courses**. This is read-only against the university: registration status and existing timetable are checked.
5. Review the account, Fall 2026–27 term, exact JSON payloads and courses already registered. Confirm the selections, then **Register selected courses**.
6. Follow per-course results. **Stop after current course** stops the remaining queue; it does not cancel a request already sent. Leaving the page also stops the remaining queue.

## Data path

`public/slotwise/app.mjs` exports a versioned account-bound selection to same-origin storage and, inside the embedded planner, to its parent using an exact target origin. The registration view accepts only messages from its own planner iframe and same origin. No PIN, token or password is exported.

`lib/registration/payload.ts` validates selections and builds the four request shapes: theory + lab uses separate theory/practical fields; theory-only and lab-only use slot_name/venue/faculty_name; project uses PROJECT, a verified faculty, an explicit venue or N/A, and course_type PRJ as supplied in the reference. Multiple combined lab pairs are blocked until their university payload format is verified.

`POST /api/course-registration/prepare` authenticates the signed session, checks Origin, validates the entire selection, performs live checks and stores an immutable 10-minute review plan bound to that user. It returns payload previews and previous results.

`POST /api/course-registration/execute` accepts only planId, courseCode and an optional explicit retryRejected flag. The client cannot provide a replacement payload, user ID, endpoint or token. The server retrieves the reviewed payload, obtains an account-wide database lock, repeats live checks and skips any course code already registered, regardless of its current section.

The server uses the current user's university token and the existing configured authentication header. It makes exactly one POST to `/api/course-registration/register`, with redirect following and automatic mutation retries disabled. It runs in the existing Mumbai region so the HTTPS application can reach the HTTP university service without mixed-content restrictions.

## Safeguards and persistence

- Only the fixed registration endpoint is used. There is no university delete, withdraw, capacity change or section replacement operation.
- Invalid/missing fields, ambiguous course codes, duplicate course codes, timetable clashes and unverified combined labs are rejected. Final edited slots are rechecked using the same Slotwise engine.
- A live enabled registration flag and live timetable are mandatory; cached data cannot authorize a write.
- Signed session identity is used; client-supplied account headers are ignored.
- Immutable server review plans expire after ten minutes and cannot be used by another account.
- `registration_user_locks` serialize operations across tabs/instances. Locks use owner IDs and bounded leases.
- `registration_attempts` has a unique key on user, term and course, including a durable pending marker written BEFORE the POST. Successful, pending and inconclusive requests cannot be sent again automatically. Only an explicit retry of a confirmed rejection is permitted.
- A timeout, crash, unexpected JSON, ambiguous 2xx or 5xx response is inconclusive. Stop the queue and check the official timetable. If the next live check finds the course, it is safely skipped. A pending outcome is never assumed to be failure.
- Attempt results remain available after page reload via a fresh review. Previously registered/successful/uncertain courses are not silently requeued.
- On Vercel, registration refuses to execute with the ephemeral file database fallback. Configure the existing persistent TURSO_DATABASE_URL/DATABASE_URL/LIBSQL_URL and its authentication token.
- No token is returned to the browser or included in exported plans. Responses expose only a bounded message, outcome and whether a request was sent.

## Validation and known limits

Run `npm run test:registration` and `npm run build`. Tests use mock university responses and an isolated SQLite database; they do not register real courses.

Payload examples are supplied by the user. Seat availability, credit limits, eligibility and exact faculty/venue matches remain subject to the university's validation. The new action is not a bypass for full slots or disabled registration. Project and combined-lab university semantics should be confirmed against the official portal before live use. No live registration was performed during implementation.

University responses that do not explicitly confirm success are shown as inconclusive. The live enabled flag currently requires `{enabled:true}` and the timetable requires registrations/allRegistrations/projectRegistrations arrays with course_code values; unknown response formats fail closed.
