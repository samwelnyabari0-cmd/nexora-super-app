# Academy Ratings & Quick Notes — Design

**Status:** Approved product design; implementation not yet started  
**Date:** 2026-11-20  
**Scope:** Learner-facing Nexora Academy  
**Primary route:** `src/routes/learn.tsx`

## 1. Goals

Add course ratings and private learner notes without changing existing enrolment, lesson progress, resource-preview, download, or publication-security behavior.

### Course ratings
- A learner may rate a course only with an `active` or `completed` row in `edu_enrollments`.
- Exactly one rating per learner per course; the learner may update their own rating.
- Integer score from 1 through 5 stars.
- Show the course average and total rating count.
- Do not expose individual rater identities or private account data.
- No written public reviews are included in this feature.

### Quick Notes
- Signed-in, enrolled learners (active or completed) may create multiple notes for a course or for an individual lesson in that course.
- Notes are private to their author. The author may list, edit, and delete their own notes.
- A course note has a course reference and no lesson reference. A lesson note has both course and lesson references.
- Notes persist in Supabase and remain available when the learner returns.
- Notes do not grant access to course lessons or resources.

## 2. Existing architecture to reuse

- Course hub, selected course and active lesson state live in `src/routes/learn.tsx`.
- `edu_courses`, `edu_lessons`, `edu_enrollments` and `edu_lesson_progress` are the existing Academy records.
- Enrolment statuses are `pending`, `active`, `completed`, `refunded`, and `cancelled`; only `active` and `completed` qualify.
- Supabase client is `src/integrations/supabase/client.ts`; session state comes from `useSession`.
- Follow existing Academy feature-module and test conventions.
- Do not reuse saved-learning tables for notes or ratings.

## 3. Proposed data model

Create two independent public tables in a new timestamped Supabase migration.

### `public.edu_course_ratings`
- `id uuid primary key`
- `course_id uuid not null references public.edu_courses(id) on delete cascade`
- `student_id uuid not null references auth.users(id) on delete cascade`
- `rating smallint not null check (rating between 1 and 5)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- Unique constraint on `(course_id, student_id)`.
- Authenticated learner may insert one row and update only their own row, subject to current active/completed enrolment.
- No client delete permission unless a later product decision requires it.
- Never expose individual rating rows to anonymous users or unrelated learners.

### `public.edu_learning_notes`
- `id uuid primary key`
- `student_id uuid not null references auth.users(id) on delete cascade`
- `course_id uuid not null references public.edu_courses(id) on delete cascade`
- `lesson_id uuid null references public.edu_lessons(id) on delete cascade`
- `title text not null` (short label)
- `body text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- Multiple rows per learner/course and per learner/lesson are allowed.
- A constraint/trigger or RLS predicate must ensure a non-null lesson belongs to the same `course_id`.
- Authenticated owner may select, insert, update, and delete only their own notes.
- Writes require an active/completed enrolment for the referenced course.
- Keep reasonable title/body length limits and reject blank/whitespace-only content in application validation and database constraints.

## 4. Security requirements

- Enable RLS on both tables.
- Revoke broad table privileges first; grant only the minimum authenticated operations needed.
- Use `auth.uid()` to bind all writes and reads to the signed-in learner.
- Enforce enrolment eligibility in database policies or narrowly scoped database functions; never rely only on hidden UI controls.
- A pending, refunded, cancelled, anonymous, or unrelated account must not read or write private notes or submit/update a rating.
- Rating eligibility must be checked on both insert and update, not only when the UI first loads.
- Do not grant anon access to raw rating rows or notes.
- Expose only aggregate rating average and count to course viewers. Prefer a narrowly scoped aggregate RPC or a carefully audited aggregate-only view; it must not reveal student IDs or individual rating rows.
- Use fixed/empty `search_path` and fully qualified object names for any SECURITY DEFINER function. Revoke execute from `public` and `anon`, grant only to the intended role.
- Preserve existing `edu_enrollments`, `edu_courses`, `edu_lessons`, `edu_resources`, `edu_resource_previews`, and Storage policies. Do not weaken existing policies or expose resource object keys.

## 5. User experience

### Course view
- Show average star rating and total number of ratings.
- Eligible learners see a 1–5 star control and their current selection; they can change and save it.
- Ineligible visitors see the aggregate only and a clear sign-in/enrolment explanation, without an enabled submission control.
- Show a **My Notes** area for course-level notes.

### Lesson view
- Show a **My Notes** area scoped to the active lesson.
- Learner can create, edit, revisit and delete multiple notes.
- Distinguish course notes from lesson notes.
- Provide loading, empty, saved, and error states; avoid losing unsaved text on transient errors.
- Keep the existing player, progress, resume, and resource-download flows intact.

### Accessibility and mobile
- Star controls must have accessible labels and keyboard support.
- Do not communicate rating values by color alone.
- Keep note editor and actions usable on narrow Android screens.
- Confirm destructive note deletion before removing a note.

## 6. Suggested implementation structure

Names are provisional and should be reconciled with existing patterns before coding:
- `src/features/academy/courseRatings.ts` — rating types, aggregate mapping, eligibility-aware operations.
- `src/features/academy/courseRatings.test.ts` — rating validation and mapping tests.
- `src/features/academy/LearningNotes.tsx` and/or `learningNotes.ts` — private notes UI and data operations.
- `src/features/academy/learningNotes.test.ts` — note validation and helper tests.
- Update `src/routes/learn.tsx` to connect course and active-lesson contexts.
- Update generated Supabase database types after the migration is finalized.
- Add a separate migration and SQL verification scripts for RLS and aggregate privacy.

## 7. Test and verification plan

### Automated tests
- Rating accepts only integer values 1–5.
- One rating per learner/course; updating the learner's own rating works.
- Average and count are correct, including no-rating courses.
- Pending/refunded/cancelled enrolments do not qualify.
- Active and completed enrolments qualify.
- A learner cannot read, edit or delete another learner's notes.
- Multiple course notes and multiple lesson notes can coexist.
- Lesson/course mismatch is rejected.
- Blank notes and over-limit content are rejected.
- UI handles signed-out, ineligible, loading, empty, success and error states.

### Database security verification
- Anonymous user cannot read notes or raw ratings.
- Unrelated authenticated user cannot read another learner's notes or rating rows.
- Eligible learner can create/update their own rating and create/read/update/delete their own notes.
- Ineligible learner cannot create/update ratings or read/write notes.
- Aggregate result exposes only average and count.
- Existing Academy and Storage RLS policies remain unchanged.
- Run Supabase security advisor and inspect relevant findings.

### Build verification
- Run focused Academy tests and lint.
- Run the repository's available test suite and production build.
- Inspect changed-file diff and repository-wide TypeScript baseline.
- Do not claim deployment or production behavior until separately verified.

## 8. Delivery boundaries

This document is the only intended change in this design step. No database migration, application code, pull request, merge, or deployment is authorized by this approval. After the design is reviewed, prepare a separate implementation plan and request approval before implementing. Production merge/deployment requires its own explicit approval.
