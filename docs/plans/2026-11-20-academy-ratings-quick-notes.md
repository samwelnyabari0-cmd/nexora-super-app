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
- Create: `supabase/migrations/20261120120000_academy_ratings_quick_notes.sql` (proposed timestamp; confirm it is later than the current remote migration head before applying)
- Create: `supabase/verification/academy_ratings_quick_notes_security.sql`
- Create: `supabase/verification/academy_ratings_quick_notes_behavior.sql`

**Interfaces:**
- Create `public.edu_course_ratings`: UUID id, course_id FK, student_id FK to auth.users, smallint rating constrained to 1–5, created_at, updated_at, unique(course_id, student_id).
- Create `public.edu_learning_notes`: UUID id, student_id FK, course_id FK, nullable lesson_id FK, title, body, created_at, updated_at. Multiple rows per learner/course/lesson are supported.
- Create private helper `private.is_edu_course_learner(p_course_id uuid, p_student_id uuid)` returning boolean; true only when `auth.uid() = p_student_id` and an enrolment for that learner/course has status active or completed.
- Create public aggregate-only table `public.edu_course_rating_summaries` with `course_id`, `average_rating`, `rating_count`, and `updated_at`. Courses with no ratings have no summary row; the UI maps that to `averageRating: null` and `ratingCount: 0`.
- Add a database guard ensuring a non-null note.lesson_id belongs to note.course_id.
- Add an updated_at trigger for note and rating updates.

- [ ] **Step 1: Add migration-level verification expectations**
  - Write SQL assertions that both tables exist, have RLS enabled, and expose no anon privileges.
  - Assert ratings are unique by course/student and constrained to 1–5.
  - Assert note lesson/course matching is enforced.
  - Assert the aggregate projection has exactly course_id, average_rating, rating_count, and updated_at; inspect read-only grants and RLS.
  - Assert the eligibility helper and trigger functions cannot be directly executed by anon/public.
  - Assert existing Academy and Storage policies have not been dropped or altered by this migration.

- [ ] **Step 2: Verify the current migration baseline**
  - Inspect the Supabase migration list before applying. If `20261120120000` is not later than the remote head or is already used, choose the next unused timestamp and update the filename in this plan/branch before proceeding.
  - Inspect the existing `edu_enrollments` RLS policy and current grants to confirm the private helper can read enrolment rows as its owner without changing those policies.

- [ ] **Step 3: Implement the migration**
  - Revoke broad privileges before granting only required operations.
  - Ratings: grant authenticated SELECT/INSERT/UPDATE only; RLS SELECT/UPDATE use `student_id = auth.uid()`; INSERT requires matching auth.uid and the eligibility helper. UPDATE must check both the existing row owner and the new row owner/eligibility. Do not grant DELETE.
  - Notes: grant authenticated SELECT/INSERT/UPDATE/DELETE only; every policy binds `student_id` to auth.uid and checks course eligibility. Ensure lesson/course matching is enforced in the database independently of the UI.
  - Keep raw rating rows inaccessible to anon and unrelated authenticated users.
  - Maintain `edu_course_rating_summaries` with a private SECURITY DEFINER trigger function using an empty search_path and fully qualified references. The public table is SELECT-only for anon/authenticated, with RLS limited to published courses. It contains no learner IDs or individual rating rows.
  - Implement the private eligibility helper with a fixed search path and fully qualified references. Grant only the minimum schema/function privileges required for authenticated RLS policy evaluation.
  - Add updated_at triggers and indexes for course/student rating lookup and learner/course/lesson note listing.
  - Do not alter existing enrolment or Storage policies.

- [ ] **Step 4: Verify the database behavior**
  - Run the structural/security SQL checks.
  - Test as anonymous, eligible learner A, eligible learner B, and an ineligible authenticated learner.
  - Expected: anon can select aggregate-only summaries but cannot select ratings or notes; learner A sees/changes only A's rating and notes; learner B cannot read or change A's data; ineligible learner cannot rate or access notes.
  - Verify active and completed enrolments qualify; pending, refunded, cancelled, and missing enrolments do not.
  - Verify multiple notes are allowed and mismatched lesson/course references are rejected.
  - Verify aggregate output contains only average and count and updates after rating insert/update.

- [ ] **Step 5: Commit the database deliverable**
  ```bash
  git add supabase/migrations/20261120120000_academy_ratings_quick_notes.sql supabase/verification/academy_ratings_quick_notes_security.sql supabase/verification/academy_ratings_quick_notes_behavior.sql
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

- [ ] **Step 1: Add failing helper tests**
  - Rating validation accepts only integer 1–5 and rejects 0, 6, fractions, NaN, and non-numeric input.
  - Summary mapping preserves null average for zero ratings and converts count/average safely.
  - Notes mapping preserves nullable lesson_id and timestamps.
  - Note editor validation rejects blank title/body after trimming; test the agreed maximum lengths once confirmed.
  - Test course-note filtering separately from lesson-note filtering.

- [ ] **Step 2: Verify the focused failures**
  - Run: `npm test -- src/features/academy/courseRatings.test.ts src/features/academy/learningNotes.test.ts`
  - Expected: tests fail because the new helpers and validation functions do not exist yet.

- [ ] **Step 3: Implement the helpers**
  - Use the existing Supabase client and explicit column selections.
  - Fetch aggregate data only from `edu_course_rating_summaries`; never query raw rating rows for averages.
  - Fetch a learner's own rating with a query filtered by course_id; RLS remains the authority.
  - Upsert rating on the unique course/student key, relying on RLS to enforce identity and eligibility.
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

- [ ] **Step 6: Commit the helper deliverable**
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
- `CourseRatingPanel({ courseId, canRate }: { courseId: string; canRate: boolean })`
- `LearningNotesPanel({ courseId, lessonId, canUseNotes }: { courseId: string; lessonId: string | null; canUseNotes: boolean })`
- Components consume the Task 2 helpers; they do not accept a user ID as authority and never bypass RLS.

- [ ] **Step 1: Add failing component tests**
  - Rating panel renders average/count for all viewers; eligible learners see 5 individually labelled star controls and their saved value; ineligible viewers cannot submit.
  - Keyboard users can focus and select star values; selected state is not communicated by color alone.
  - Notes panel shows sign-in/enrolment explanation when ineligible.
  - Eligible learner sees distinct course-note or lesson-note heading, an empty state, list of saved notes, and create/edit/delete controls.
  - Test loading, empty, success, and error states.
  - Deletion requires confirmation; cancelling leaves the note unchanged.
  - On save failure, keep the editor contents so the learner does not lose unsaved text.

- [ ] **Step 2: Verify focused failures**
  - Run: `npm test -- src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.test.tsx`
  - Expected: tests fail because components are not yet implemented.

- [ ] **Step 3: Implement accessible components**
  - Use semantic buttons with accessible names such as `Rate 1 out of 5 stars`; support keyboard operation and expose the current value.
  - Show a clear no-ratings state and average/count from the aggregate helper.
  - For eligible learners, load their own rating and allow create/update; show success and error feedback.
  - Notes panel loads only notes for its supplied course/lesson scope. Support multiple note entries, editor title/body, edit, save, cancel, and confirmed delete.
  - Keep editor state after a failed save and refresh the list after successful create/update/delete.
  - Do not render another user's notes or individual ratings.
  - Proposed initial note limits: title up to 100 characters and body up to 5,000 characters. These are recommendations pending confirmation; align database constraints and UI counters if adopted.

- [ ] **Step 4: Verify focused component tests**
  - Run: `npm test -- src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.test.tsx`
  - Expected: all component tests pass, including keyboard and error-state cases.

- [ ] **Step 5: Run component lint**
  - Run: `npx eslint src/features/academy/CourseRatingPanel.tsx src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx`
  - Expected: no new lint errors.

- [ ] **Step 6: Commit the component deliverable**
  ```bash
  git add src/features/academy/CourseRatingPanel.tsx src/features/academy/CourseRatingPanel.test.tsx src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx
  git commit -m "feat(academy): add course ratings and private notes panels"
  ```

## Task 4: Integrate panels into the Academy course and lesson experience

**Files:**
- Modify: `src/routes/learn.tsx`
- Test: `src/routes/learn.test.tsx` (proposed; first inspect whether route-level tests already exist and follow the established test harness)
- Modify: `src/integrations/supabase/types.ts` only if final generated types need route integration adjustments

**Interfaces:**
- Use `CourseRatingPanel` with the selected course ID and an eligibility boolean derived from the current signed-in user plus the existing `enrollmentStatus` state.
- Use `LearningNotesPanel` with selected course ID and `lessonId={null}` for course notes; render a second instance scoped to `activeLesson.id` for lesson notes.
- Eligibility UI must never replace or weaken database enforcement.

- [ ] **Step 1: Add failing integration tests**
  - Course dialog shows aggregate rating for signed-out, ineligible, active, and completed users.
  - Only active/completed enrolled users can interact with the rating control and notes editor.
  - Course-level notes remain scoped to `lesson_id IS NULL`; lesson notes are scoped to the active lesson.
  - Switching active lessons changes the lesson-note scope without changing course notes.
  - Closing/reopening the course dialog reloads saved rating and notes from Supabase.
  - Existing lesson player, resume/progress updates, resource preview and download controls remain available and unchanged.

- [ ] **Step 2: Verify the focused integration failure**
  - Run the route/component integration test command established by the repository test harness.
  - Expected: new integration assertions fail before the route is connected to the panels.

- [ ] **Step 3: Integrate with minimal route changes**
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
  - Run: `npm test` — all existing and new Vitest tests pass.
  - Run: `npm run lint` — no new errors; report pre-existing warnings separately.
  - Run: `npm run build` — production build completes.
  - Run: `npx tsc --noEmit` — no new errors in changed files relative to the recorded baseline.
  - Re-run the database security verification after all schema/policy changes and inspect Supabase security advisor findings for the new objects.
  - Manually test on the production-like preview only after a preview is available: anonymous view, eligible learner, ineligible learner, two different learners, multiple notes, edit/delete, and mobile layout.

- [ ] **Step 6: Commit the integration deliverable**
  ```bash
  git add src/routes/learn.tsx src/routes/learn.test.tsx
  git commit -m "feat(academy): integrate ratings and notes into learning"
  ```

## Approved product decisions

1. Note title is limited to 100 characters; note body is limited to 5,000 characters.
2. Empty aggregate displays `No ratings yet` with a zero count and no numeric average.
3. Ratings can be edited but not deleted by learners.
4. Existing ratings remain in the course average after a later refund/cancellation; the learner cannot edit the rating or access notes while ineligible.

