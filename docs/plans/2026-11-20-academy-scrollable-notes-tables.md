# Academy Scrollable Notes Tables Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Academy course page compact by displaying course-level notes and all lesson-level notes in two independent, fixed-height scrollable tables.

**Architecture:** Reuse `LearningNotesPanel` and the existing Supabase notes table/RLS. Add an all-notes-for-course read path for the lesson-notes panel, pass the already-loaded lesson metadata from `learn.tsx`, and render course and lesson notes in separate semantic tables with sticky headers and 320px scroll regions. The active lesson remains the target for newly created lesson notes; existing lesson notes from every lesson in the course appear together with their lesson names.

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase JS, Tailwind CSS, Vitest, React Testing Library, ESLint, Vite.

## Global Constraints

- Course Notes shows only notes whose `lesson_id` is null.
- Lesson Notes shows lesson-level notes from all lessons in the current course, not only the active lesson.
- Each lesson note displays its associated lesson name; unresolved lesson IDs display the neutral fallback `Lesson`.
- Each table has an independently scrollable region with a fixed maximum height of 320px and a sticky header.
- The note editor remains outside the scrollable table region.
- Tables must remain usable on narrow/mobile screens. Horizontal scrolling may be confined to the table wrapper, and long note text must wrap.
- Preserve create, edit, delete, delete confirmation, existing title/body limits, validation, loading/error/empty/sign-in/access states, and note ownership.
- Keep new lesson-note creation associated with the currently selected lesson.
- Do not change database schema, RLS policies, grants, storage, retention, eligibility, or ownership rules.
- Do not change ratings, progress, resource previews, or unrelated Academy UI.

---

### Task 1: Add a course-wide lesson-notes read path

**Files:**
- Modify: `src/features/academy/learningNotes.ts`
- Modify: `src/features/academy/learningNotes.test.ts`
- Test: `src/features/academy/learningNotes.test.ts`

**Interfaces:**
- Consumes: existing `LearningNote` type and Supabase client.
- Produces: `listAllLearningNotes(courseId: string): Promise<{ data: LearningNote[]; error: Error | null }>`, which reads all notes for one course without filtering on `lesson_id`.
- Preserve: existing `listLearningNotes(courseId, lessonId)` behavior for course-level and single-lesson scopes; existing create/update/delete interfaces remain unchanged.

- [ ] **Step 1: Add the focused failing test**

Add a test for the all-course query that verifies it filters by the supplied `course_id`, does not apply either `.is("lesson_id", null)` or `.eq("lesson_id", ...)`, orders by `updated_at` descending, maps both null and non-null lesson IDs, and returns an empty data array plus the original error when Supabase returns an error. Use a mocked Supabase query chain consistent with existing Academy service tests.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/academy/learningNotes.test.ts`

Expected: the new test fails because `listAllLearningNotes` does not yet exist; existing validation and mapping tests continue to pass.

- [ ] **Step 3: Implement the minimum behavior**

Add `listAllLearningNotes(courseId)` beside `listLearningNotes`. Select the same note columns, filter only by `course_id`, order by `updated_at` descending, map rows with `mapLearningNote`, and preserve the established `{ data: [], error }` failure shape. Do not alter the existing scoped query or database.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/academy/learningNotes.test.ts`

Expected: all learning-notes service tests pass, including mixed course/lesson mapping and query-scope assertions.

- [ ] **Step 5: Run the affected integration check**

Run: `npx eslint src/features/academy/learningNotes.ts src/features/academy/learningNotes.test.ts`

Expected: no lint errors.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/academy/learningNotes.ts src/features/academy/learningNotes.test.ts
git commit -m "feat(academy): add course-wide lesson notes query"
```

### Task 2: Render the two independent scrollable notes tables

**Files:**
- Modify: `src/features/academy/LearningNotesPanel.tsx`
- Modify: `src/features/academy/LearningNotesPanel.test.tsx`
- Modify: `src/routes/learn.tsx`
- Test: `src/features/academy/LearningNotesPanel.test.tsx`

**Interfaces:**
- Consumes: `listLearningNotes(courseId, null)` for course notes; `listAllLearningNotes(courseId)` for lesson notes; existing `Lesson` metadata in `src/routes/learn.tsx`.
- Extend `LearningNotesPanel` props with optional lesson metadata shaped as `Array<{ id: string; title: string }>`.
- Existing `courseId`, `lessonId`, `isSignedIn`, and `canUseNotes` props retain their meanings. A null `lessonId` renders the course-notes panel; a non-null `lessonId` renders all lesson notes and uses that active lesson ID for new note creation.

- [ ] **Step 1: Add the focused failing tests**

Update panel tests to assert:
1. The course panel lists only course-level notes and has a fixed-height scroll container with a sticky table header.
2. The lesson panel lists notes from two or more different lesson IDs in one table, displays the matching lesson titles beside each note, and keeps notes visible when the active lesson changes.
3. A lesson ID missing from the supplied metadata displays `Lesson`.
4. Course-level notes are excluded from the lesson table, and lesson-level notes are excluded from the course table.
5. Long note bodies wrap within the table; the scroll container has its own vertical overflow and does not force page-wide width.
6. Existing create, edit, delete confirmation, loading, empty, error, signed-out, and ineligible behaviors remain intact.
7. Saving a new lesson note still passes the active `lessonId` to `createLearningNote`.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/academy/LearningNotesPanel.test.tsx`

Expected: the new table, lesson-name, and course-wide visibility assertions fail before implementation; existing behavior tests remain valid or require only fixture adjustments for the new query mock.

- [ ] **Step 3: Implement the minimum behavior**

In `LearningNotesPanel`:
- Use `listLearningNotes(courseId, null)` for the course panel and `listAllLearningNotes(courseId)` for the lesson panel.
- Filter the resulting lesson-panel data to notes with a non-null `lessonId`; do not display course-level notes in that table.
- Keep `createLearningNote({ courseId, lessonId, title, body })` unchanged so new lesson notes attach to the active lesson.
- Resolve each lesson note's ID against the supplied lesson metadata and show its title in a dedicated Lesson column; use `Lesson` if no match exists.
- Render semantic tables with columns for lesson (lesson table only), note title, note content, last updated, and actions.
- Place each table in its own `max-h-80`/320px `overflow-y-auto` wrapper. Keep the header sticky at the top of that wrapper.
- Confine any horizontal overflow to the table wrapper; use a table minimum width only where necessary and apply wrapping/breaking styles to title and body cells.
- Keep the editor, loading/error/empty states, and action confirmation UI outside the scroll region or within the relevant row without changing their behavior.
- Keep the displayed note count scoped to the relevant table.

In `learn.tsx`, pass the already-loaded `lessons.map(({ id, title }) => ({ id, title }))` metadata to the lesson-notes panel. Keep the course-notes panel course-scoped and do not introduce another lesson query.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/academy/LearningNotesPanel.test.tsx src/features/academy/learningNotes.test.ts`

Expected: all notes tests pass, including cross-lesson listing, lesson-name mapping, scope separation, fixed-height/sticky table structure, and preserved note actions.

- [ ] **Step 5: Run the affected integration checks**

Run: `npx eslint src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx src/features/academy/learningNotes.ts src/features/academy/learningNotes.test.ts src/routes/learn.tsx`

Expected: no lint errors.

Run: `npm run build`

Expected: the production build completes successfully.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/academy/LearningNotesPanel.tsx src/features/academy/LearningNotesPanel.test.tsx src/features/academy/learningNotes.ts src/features/academy/learningNotes.test.ts src/routes/learn.tsx
git commit -m "feat(academy): add scrollable course and lesson notes tables"
```

## Unresolved product decisions

None. The approved design settles table contents, lesson-name fallback, height, scrolling, mobile behavior, editor placement, and preservation of existing note actions and access controls.
