# Academy Ratings & Quick Notes Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure 1–5 course ratings and private, persistent course/lesson notes to the Nexora Academy learner experience.

**Architecture:** Add dedicated RLS-protected rating and note tables. A read-only aggregate projection table exposes only average/count, maintained by a private trigger; RLS policies verify enrolment eligibility directly against the learner's own enrolment row; notes remain owner-only. Build small Academy feature modules and integrate them into the existing course dialog in `src/routes/learn.tsx`.

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase JS/Postgres, PostgreSQL RLS and PL/pgSQL, Vitest, ESLint, Vite.

## Global Constraints

- Only learners with an `active` or `completed` enrolment may rate a course or create/read/edit/delete their notes.
- One rating per learner per course; the learner can update their rating. Rating is an integer from 1 through 5.
- Show average stars and total rating count without exposing individual rater identities.
- Learners may create multiple notes per course and per lesson. Course notes have no lesson reference; lesson notes refer to a lesson belonging to the same course.
- Notes are private to their author. The author may list, edit, and delete their own notes.
- Notes do not grant access to lessons, videos, or resources.
- Keep existing enrolment, lesson progress, resource-preview, download, and publication-security behavior unchanged.
- Do not weaken existing `edu_enrollments`, `edu_courses`, `edu_lessons`, `edu_resources`, `edu_resource_previews`, or Storage policies.
- No anon access to raw ratings or notes. Aggregate results may be public, but must contain only average and count.
- Database enforcement is authoritative; UI visibility alone is not security.
- Any SECURITY DEFINER function must use a fixed safe search path, fully qualified object references, an appropriate owner, and least-privilege EXECUTE grants.
- No production deployment, merge, paid upgrade, or billing change is included in this plan. Each requires separate explicit approval.

---

## Repository findings

- Observed learner route: `src/routes/learn.tsx`; it owns the selected-course dialog, selected course, active lesson, enrolment state, lesson list, and video state.
- Observed session source: `useSession` from `src/lib/session`.
- Observed Supabase client: `src/integrations/supabase/client.ts`.
- Observed generated database types: `src/integrations/supabase/types.ts`.
- Observed Academy test convention: Vitest files alongside feature modules, e.g. `src/features/academy/courseProgress.test.ts`.
- Observed package commands: `npm test`, `npm run lint`, and `npm run build`.
- Observed enrolment statuses include `active` and `completed`; existing learner dashboard queries both.
- The selected course and lesson UI are in a large route file. Keep changes localized; do not refactor unrelated route behavior.

## Task 1: Add secure rating and notes database primitives

**Files:**
- Create: `supabase/migrations/20261119212938_academy_ratings_quick_notes.sql`
- Create: `supabase/migrations/20261119213012_academy_course_rating_aggregate_projection.sql`
- Create: `supabase/migrations/20261119213526_academy_course_rating_summary_delete_safety.sql`
- Create: `supabase/verification/academy_ratings_quick_notes_security.sql`
- Create: `supabase/verification/academy_ratings_quick_notes_behavior.sql`

**Interfaces:**
- Create `public.edu_course_ratings`: UUID id, course_id FK, student_id FK to auth.users, smallint rating constrained to 1–5, created_at, updated_at, unique(course_id, student_id).
- Create `public.edu_learning_notes`: UUID id, student_id FK, course_id FK, nullable lesson_id FK, title, body, created_at, updated_at. Multiple rows per learner/course/lesson are supported.
- Enforce eligibility in each RLS policy with an `EXISTS` check against the learner's own `public.edu_enrollments` row (`student_id = auth.uid()` and status `active` or `completed`). The existing enrolment RLS policy already allows learners to read their own enrolment rows, so no additional eligibility helper or policy change is needed.
- Create public aggregate-only table `public.edu_course_rating_summaries` with `course_id`, `average_rating`, `rating_count`, and `updated_at`. Courses with no ratings have no summary row; the UI maps that to `averageRating: null` and `ratingCount: 0`.
- Add a database guard ensuring a non-null note.lesson_id belongs to note.course_id.
- Add an updated_at trigger for note and rating updates.

- [x] **Step 1: Add migration-level verification expectations**
  - Write SQL assertions that rating and note tables have RLS and no anon access; the aggregate table allows anon SELECT only for published courses and grants no client writes.
  - Assert ratings are unique by course/student and constrained to 1–5.
  - Assert note lesson/course matching is enforced.
  - Assert the aggregate projection has exactly course_id, average_rating, rating_count, and updated_at; inspect read-only grants and RLS.
  - Assert private trigger functions cannot be directly executed by anon/public and use the required fixed search_path and ownership.
  - Assert existing Academy and Storage policies have not been dropped or altered by this migration.

- [x] **Step 2: Verify the current migration baseline**
  - Inspected the remote migration list and matched each repository migration filename to the exact applied Supabase version.
  - Confirmed the existing `edu_enrollments` policies allow learners to read their own rows; the existing policies remain unchanged.

- [x] **Step 3: Implement the migration**
  - Revoke broad privileges before granting only required operations.
  - Ratings: grant authenticated SELECT, INSERT of course_id/student_id/rating, and UPDATE of rating only; RLS SELECT/UPDATE use `student_id = auth.uid()`; INSERT and UPDATE checks require matching auth.uid and an active/completed enrolment. Do not grant DELETE.
  - Notes: grant authenticated SELECT/INSERT/UPDATE/DELETE only; every policy binds `student_id` to auth.uid and checks course eligibility. Ensure lesson/course matching is enforced in the database independently of the UI.
  - Keep raw rating rows inaccessible to anon and unrelated authenticated users.
  - Maintain `edu_course_rating_summaries` with a private SECURITY DEFINER trigger function using an empty search_path and fully qualified references. The public table is SELECT-only for anon/authenticated, with RLS limited to published courses. It contains no learner IDs or individual rating rows.
  - Use inline enrolment EXISTS checks in the RLS policies; do not add a separate eligibility function or alter existing enrolment policies.
  - Add updated_at triggers and indexes for course/student rating lookup and learner/course/lesson note listing.
  - Do not alter existing enrolment or Storage policies.

- [x] **Step 4: Verify the database behavior**
  - Run the structural/security SQL checks.
  - Test as anonymous, eligible learner A, eligible learner B, and an ineligible authenticated learner.
  - Expected: anon can select aggregate-only summaries but cannot select ratings or notes; learner A sees/changes only A's rating and notes; learner B cannot read or change A's data; ineligible learner cannot rate or access notes.
  - Verify active and completed enrolments qualify; pending, refunded, cancelled, and missing enrolments do not.
  - Verify multiple notes are allowed and mismatched lesson/course references are rejected.
  - Verify aggregate output contains only average and count and updates after rating insert/update.

- [x] **Step 5: Commit the database deliverable to the implementation branch**
  ```bash
  git add supabase/migrations/20261119212938_academy_ratings_quick_notes.sql supabase/migrations/20261119213012_academy_course_rating_aggregate_projection.sql supabase/migrations/20261119213526_academy_course_rating_summary_delete_safety.sql supabase/verification/academy_ratings_quick_notes_security.sql supabase/verification/academy_ratings_quick_notes_behavior.sql
  git commit -m "feat(academy): add secure ratings and learning notes schema"
  ```

## Task 2: Add typed Academy data helpers and unit tests

**Files:**
- Create: `src/features/academy/courseRatings.ts`
- Create: `src/features/academy/courseRatings.test.ts`
- Create: `src/features/academy/learningNotes.ts`
- Create: `src/features/academy/learningNotes.test.ts`
- Modify: `src/integrations/supabase/types.ts` (regenerate/update after the migration is applied and verified)

**Interfaces:**
- `CourseRatingSummary = { averageRating: number | null; ratingCount: number }`
- `CourseRating = { courseId: string; rating: number }`
- `getCourseRatingSummary(courseId: string): Promise<{ data: CourseRatingSummary | null; error: Error | null }>`
- `getMyCourseRating(courseId: string): Promise<{ data: CourseRating | null; error: Error | null }>`
- `saveCourseRating(courseId: string, rating: number): Promise<{ error: Error | null }>`
- `LearningNote = { id: string; courseId: string; lessonId: string | null; title: string; body: string; createdAt: string; updatedAt: string }`
- `listLearningNotes(courseId: string, lessonId?: string | null): Promise<{ data: LearningNote[]; error: Error | null }>`
- `createLearningNote(input: { courseId: string; lessonId?: string | null; title: string; body: string }): Promise<{ data: LearningNote | null; error: Error | null }>`
- `updateLearningNote(noteId: string, input: { title: string; body: string }): Promise<{ error: Error | null }>`
- `deleteLearningNote(noteId: string): Promise<{ error: Error | null }>`

- [x] **Step 1: Add helper tests**
  - Rating validation accepts only integer 1–5 and rejects 0, 6, fractions, NaN, and non-numeric input.
  - Summary mapping preserves null average for zero ratings and converts count/average safely.
  - Notes mapping preserves nullable lesson_id and timestamps.
  - Note editor validation rejects blank title/body after trimming; test the agreed maximum lengths once confirmed.
  - Verify the helper uses `lesson_id IS NULL` for course notes and an exact lesson_id filter for lesson notes; the transactional SQL checks both note scopes.

- [ ] **Step 2: Run focused helper tests**
  - Not yet executed: the Vercel preview checks are blocked by the account's build-rate limit, and this repository has no GitHub Actions workflow. No red test run is claimed.

- [x] **Step 3: Implement the helpers**
  - Use the existing Supabase client and explicit column selections.
  - Fetch aggregate data only from `edu_course_rating_summaries`; never query raw rating rows for averages.
  - Fetch a learner's own rating with a query filtered by course_id; RLS remains the authority.
  - Read the learner's existing rating, update only the rating column when it exists, otherwise insert; handle a unique-key race by retrying the rating-only update.
  - List notes by course; when lessonId is supplied, scope to that lesson; when omitted, scope to course-level notes only (`lesson_id IS NULL`).
  - Create/update/delete notes with explicit selected fields and map database errors into stable Error results.
  - Keep authentication and authorization in database policies; client-side checks are for presentation only.

- [ ] **Step 4: Verify focused helper tests**
  - Run: `npm test -- src/features/academy/courseRatings.test.ts src/features/academy/learningNotes.test.ts`
  - Expected: all helper validation/mapping tests pass.

- [ ] **Step 5: Run integration checks**
  - Run: `npm run lint -- --no-warn-ignored src/features/academy/courseRatings.ts src/features/academy/learningNotes.ts` (if the repository ESLint CLI does not support this file-scoped form, use `npx eslint <exact files>`).
  - Run: `npx tsc --noEmit` and compare any errors with the known repository baseline; no new errors may originate in the changed files.
  - Update Supabase generated types from the verified schema using the repository's established generation process; do not hand-invent relationship metadata.

- [x] **Step 6: Commit the helper deliverable to the implementation branch**
  ```bash
  git add src/features/academy/courseRatings.ts src/features/academy/courseRatings.test.ts src/features/academy/learningNotes.ts src/features/academy/learningNotes.test.ts src/integrations/supabase/types.ts
  git commit -m "feat(academy): add rating and learning note data helpers"
  ```

## Task 3: Build accessible course rating and private notes components

**Files:**
- Create: `src/features/academy/CourseRatingPanel.tsx`
- Create: `src/features/academy/CourseRatingPanel.test.tsx`
- Create: `src/features/academy/LearningNotesPanel.tsx`
- Create: `src/features/academy/LearningNotesPanel.test.tsx`

**Interfaces:**
- `CourseRatingPanel({ courseId, isSignedIn, canRate }: { courseId: string; isSignedIn: boolean; canRate: boolean })`
- `LearningNotesPanel({ courseId, lessonId, isSignedIn, canUseNotes }: { courseId: string; lessonId: string | null; isSignedIn: boolean; canUseNotes: boolean })`
- Components consume the Task 2 helpers; they do not accept a user ID as authority and never bypass RLS.

- [x] **Step 1: Add component tests**
  - Rating panel renders average/count for all viewers; eligible learners see 5 individually labelled star controls and their saved value; ineligible viewers cannot submit.
  - Keyboard users can focus and select star values; selected state is not communicated by color alone.
  - Notes panel shows sign-in/enrolment explanation when ineligible.
  - Eligible learner sees distinct course-note or lesson-note heading, an empty state, list of saved notes, and create/edit/delete controls.
  - Test loading, empty, success, and error states.
  - Deletion requires confirmation; cancelling leaves the note unchanged.
  - On save failure, keep the editor contents so the learner does not lose unsaved text.

- [ ] **Step 2: Run focused component tests**
  - Not yet executed: no local repository checkout is available in this session and Vercel preview builds are blocked by the build-rate limit. No red test run is claimed.

- [x] **Step 3: Implement accessible components**
  - Use semantic buttons with accessible names such as `Rate 1 out of 5 stars`; support keyboard operation and expose the current value.
  - Show a clear no-ratings state and average/count from the aggregate helper.
  - For eligible learners, load their own rating and allow create/update; show success and error feedback.
  - Notes panel loads only notes for its supplied course/lesson scope. Support multiple note entries, editor title/body, edit, save, cancel, and confirmed delete.
  - Keep editor state after a failed save and refresh the list after successful create/update/delete.
  - Do not render another user's notes or individual ratings.
  - Enforce the approved limits: title up to 100 Unicode characters and body up to 5,000 Unicode characters; keep UI counters and database constraints aligned.

- [ ] **Step 4: Verify focused component tests**
  - Run: `npm test -- src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.test.tsx`
  - Expected: all component tests pass, including keyboard and error-state cases.

- [ ] **Step 5: Run component lint**
  - Run: `npx eslint src/features/academy/CourseRatingPanel.tsx src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx`
  - Expected: no new lint errors.

- [x] **Step 6: Commit the component deliverable to the implementation branch**
  ```bash
  git add src/features/academy/CourseRatingPanel.tsx src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx
  git commit -m "feat(academy): add course ratings and private notes panels"
  ```

## Task 4: Integrate panels into the Academy course and lesson experience

**Files:**
- Modify: `src/routes/learn.tsx`
- Test: `src/features/academy/CourseRatingPanel.test.tsx` and `src/features/academy/LearningNotesPanel.test.tsx` (component-level coverage)
- Modify: `src/integrations/supabase/types.ts` only if final generated types need route integration adjustments

**Interfaces:**
- Use `CourseRatingPanel` with the selected course ID and an eligibility boolean derived from the current signed-in user plus the existing `enrollmentStatus` state.
- Use `LearningNotesPanel` with selected course ID and `lessonId={null}` for course notes; render a second instance scoped to `activeLesson.id` for lesson notes.
- Eligibility UI must never replace or weaken database enforcement.

- [x] **Step 1: Add component and database behavior coverage**
  - Course dialog shows aggregate rating for signed-out, ineligible, active, and completed users.
  - Only active/completed enrolled users can interact with the rating control and notes editor.
  - Course-level notes remain scoped to `lesson_id IS NULL`; lesson notes are scoped to the active lesson.
  - Switching active lessons changes the lesson-note scope without changing course notes.
  - Closing/reopening the course dialog reloads saved rating and notes from Supabase.
  - Existing lesson player, resume/progress updates, resource preview and download controls remain available and unchanged.

- Route-level integration tests were not added; the route wiring is covered by component tests and transactional database verification. Full route/browser verification remains pending.

- [x] **Step 3: Integrate with minimal route changes**
  - Derive `canRate` and `canUseNotes` from `Boolean(user) && enrollmentStatus === "enrolled"`; the database policies remain authoritative.
  - Place course rating summary/control in the selected-course dialog near the course description.
  - Place course-level My Notes in the course details area.
  - Place lesson-level My Notes in the active lesson area and key it by course/lesson identity to prevent stale notes when switching lessons.
  - Preserve current close behavior, selected-course state, lesson player, resume flow, progress save logic, resource access logic and mobile dialog layout.
  - Ensure signed-out/ineligible users receive a clear sign-in/enrolment explanation rather than a nonfunctional editor.

- [ ] **Step 4: Verify integration tests**
  - Run the focused integration tests.
  - Expected: all eligibility, scope-switching, reload, and existing-flow regression assertions pass.

- [ ] **Step 5: Run full verification**
  - Pending: `npm test`, `npm run lint`, `npm run build`, and `npx tsc --noEmit` could not be run because Vercel preview builds are blocked by the account's build-rate limit and no GitHub Actions workflow exists in this repository. Do not treat these checks as passing.
  - Re-run the database security verification after all schema/policy changes and inspect Supabase security advisor findings for the new objects.
  - Manually test on the production-like preview only after a preview is available: anonymous view, eligible learner, ineligible learner, two different learners, multiple notes, edit/delete, and mobile layout.

- [x] **Step 6: Commit the integration deliverable to the implementation branch**
  ```bash
  git add src/routes/learn.tsx src/features/academy/CourseRatingPanel.tsx src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx
  git commit -m "feat(academy): integrate ratings and notes into learning"
  ```

## Approved product decisions

1. Note title is limited to 100 characters; note body is limited to 5,000 characters.
2. Empty aggregate displays `No ratings yet` with a zero count and no numeric average.
3. Ratings can be edited but not deleted by learners.
4. Existing ratings remain in the course average after a later refund/cancellation; the learner cannot edit the rating or access notes while ineligible.

