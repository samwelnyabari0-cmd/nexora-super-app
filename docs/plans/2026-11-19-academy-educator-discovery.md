# Academy Educator Discovery and Saved Learning Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add education-only instructor discovery, educator Showcase profiles, follow controls, and persistent saved courses, lessons, resources, and educators to Nexora Academy without breaking existing Academy behavior.

**Architecture:** Keep the Academy route as the entry point, extract focused educator discovery and saved-learning components under `src/features/academy/`, and use narrowly scoped Supabase RPCs for public educator data because the current `profiles` RLS policy allows users to read only their own profile. Reuse the existing `follows` table and `useSocialGraph` hook; add a dedicated owner-scoped saved-learning table rather than repurposing social-post bookmarks.

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase Postgres/RLS/RPC, Vitest, React Testing Library, Tailwind CSS.

## Global Constraints

- Only include profiles explicitly classified for education; do not include ordinary Nexora users or unrelated social creators.
- Educators may appear before publishing an Academy course.
- Respect `profiles.discoverable` and `profiles.private_profile`; public discovery must exclude non-discoverable and private profiles.
- Preserve the existing Search Courses behavior, My Learning dashboard, lesson playback/progress, secure resource access, and local saved-course data.
- Reuse `follows`, not `user_follows`; the existing `useSocialGraph` hook and profile UI both use `follows`.
- Never expose student identities in educator statistics.
- Do not invent verification badges or ratings. No verified field or Academy review table was found in the inspected schema.
- Saving a lesson/resource must never grant access; existing enrollment, payment, and resource access checks remain authoritative.
- Do not deploy or change billing settings as part of implementation. Verify the Vercel free deployment limit separately before any deployment attempt.

---

### Task 1: Establish safe educator profile data and education skills

**Files:**
- Modify: `src/routes/profile-settings.tsx` (observed)
- Modify: `src/integrations/supabase/types.ts` (observed generated type file; update only through the project's type-generation workflow if available)
- Create: `supabase/migrations/<generated_timestamp>_academy_educator_directory.sql` (proposed; create with `supabase migration new academy_educator_directory`, never hand-invent the timestamp)
- Create: `src/features/academy/educatorDirectory.ts` (proposed pure search/filter helpers)
- Test: `src/features/academy/educatorDirectory.test.ts` (proposed)
- Test: `src/features/academy/educatorDirectory.rpc.test.ts` (proposed integration/RPC contract tests, using the existing Vitest setup)

**Interfaces:**
- Profile field: `profiles.education_skills text[]`, default empty array.
- Profile editor reads/writes `education_skills` only for an education-classified profile; the current profile editor already stores `account_type` and `profile_category`.
- RPC: `search_academy_educators(p_query text, p_skill text, p_limit integer, p_offset integer)` returns only safe public profile fields: educator ID, display name, handle, bio, avatar URL, profile category, and education skills.
- RPC: `get_academy_educator_stats(p_educator_id uuid)` returns aggregate published-course, lesson, and distinct enrolled-student counts only; it must not return student IDs or enrollment rows.
- Pure helper: `filterEducators(educators, query, skill)` supports case-insensitive name, handle, bio, and skill matching for deterministic client-side filtering of already-authorized results.

- [ ] **Step 1: Add focused failing tests**

Test that:
1. `filterEducators` matches display name, handle, bio, and skill case-insensitively.
2. A selected skill chip excludes profiles without that skill.
3. An empty query and no skill returns all supplied eligible educators.
4. An empty education skill array is valid and does not break profile rendering.
5. RPC result mapping accepts educators with zero published courses.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/features/academy/educatorDirectory.test.ts`

Expected: the new test file initially fails because the helper has not yet been implemented.

- [ ] **Step 3: Implement the minimum behavior**

1. Confirm the exact profile eligibility values. The current profile editor exposes `profile_category = 'education'` (labelled “Education & Lifestyle”) for Creator and Business account types; current database samples contain no education-category profile. Do not broaden discovery based on ordinary posts or bio text alone.
2. Add `education_skills text[] NOT NULL DEFAULT '{}'` to `profiles`.
3. Add an education skills editor to `profile-settings.tsx`, displayed when `profile_category = 'education'`; provide the initial chips React, WebGL, UI/UX, and Video Editing plus a way to enter additional skills. Persist skills in the profile row.
4. Add read-only RPCs with a fixed, explicit return-column list. Since `profiles` currently has owner-only SELECT RLS, do not query the full profiles table from the public client. Use a narrowly scoped database function that returns only approved public educator fields, explicitly filters `discoverable = true` and `private_profile = false`, and checks education classification. If a SECURITY DEFINER function is required to serve this safe projection, set a fixed search path, fully qualify objects, keep it read-only, grant execute only to the intended API roles, and verify its output and permissions.
5. The stats RPC returns counts for published courses, their lessons, and distinct students with eligible active/completed enrollments. It returns no raw learner identifiers.
6. Implement and test `filterEducators`.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/features/academy/educatorDirectory.test.ts`

Expected: all helper tests pass.

- [ ] **Step 5: Run the affected integration and security checks**

Run: `npm test -- src/features/academy/educatorDirectory.rpc.test.ts`

Expected: public eligible educators are returned; personal, non-education, private, and non-discoverable profiles are excluded; stats contain aggregate counts only. Also run Supabase advisors and inspect function grants/RLS before continuing.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/profile-settings.tsx src/integrations/supabase/types.ts src/features/academy/educatorDirectory.ts src/features/academy/educatorDirectory.test.ts src/features/academy/educatorDirectory.rpc.test.ts supabase/migrations
git commit -m "feat: add education educator profile data"
```

---

### Task 2: Add educator search and Showcase profiles to Academy

**Files:**
- Modify: `src/routes/learn.tsx` (observed; current Academy route and course search)
- Create: `src/features/academy/EducatorDirectory.tsx` (proposed)
- Create: `src/features/academy/EducatorShowcase.tsx` (proposed)
- Create: `src/features/academy/educatorDirectory.test.tsx` (proposed component tests)

**Interfaces:**
- `EducatorDirectory` calls `search_academy_educators` and emits `onSelectEducator(educatorId: string)`.
- `EducatorShowcase` receives `educatorId: string` and `onBack(): void`; it loads the public educator profile, stats, published courses, and access-permitted content.
- Follow control uses `useSocialGraph(educatorId)`, which already reads and writes the canonical `follows` table.
- Existing `Course`, `Lesson`, and `Resource` types in `learn.tsx` remain compatible with current course playback and resource access paths.

- [ ] **Step 1: Add focused failing component tests**

Test that:
1. Search mode tabs switch between Search Courses and Instructors & Educators.
2. Existing course search remains unchanged when switching back.
3. Educator search displays only RPC-returned eligible educators.
4. Name/handle/bio search and React, WebGL, UI/UX, and Video Editing chips update results.
5. Tapping a result opens its Showcase; back returns to the educator results.
6. An educator with no courses still displays profile and skills with a “No Academy courses yet” empty state.
7. Showcase shows course, lesson, and student counts from the stats RPC and never renders fabricated rating or verification UI.
8. Signed-out visitors can view public Showcase data; follow action prompts sign-in.
9. Loading, no-results, and RPC-error states render clearly.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/features/academy/educatorDirectory.test.tsx`

Expected: new component tests fail before the components are implemented.

- [ ] **Step 3: Implement the minimum behavior**

1. Add the two search modes in `learn.tsx`; keep existing course query state and filtering intact.
2. Render `EducatorDirectory` only in the educator mode.
3. Add Showcase navigation/state without replacing the current course detail/player flow.
4. Load published courses by `instructor_id`; show their lessons and resources only through existing Academy access rules.
5. Use aggregate stats from Task 1. Do not query or render enrollment identities.
6. Reuse `useSocialGraph` for follow state and toggling. Show follow errors rather than silently claiming the action succeeded; do not create a second follow table or duplicate notifications.
7. Provide mobile-friendly loading, empty, signed-out, and error states.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/features/academy/educatorDirectory.test.tsx`

Expected: all educator search and Showcase component tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `npm test -- src/features/academy/educatorDirectory.test.tsx src/test/app-routing.test.tsx`

Expected: educator routes/state work and existing route tests remain green. Manually verify the existing course modal, lesson playback, progress saving, and resource library are unchanged.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/learn.tsx src/features/academy/EducatorDirectory.tsx src/features/academy/EducatorShowcase.tsx src/features/academy/educatorDirectory.test.tsx
git commit -m "feat: add Academy educator discovery"
```

---

### Task 3: Add persistent saved learning items

**Files:**
- Create: `supabase/migrations/<generated_timestamp>_academy_saved_items.sql` (proposed; create with `supabase migration new academy_saved_items`)
- Create: `src/features/academy/savedLearning.ts` (proposed data-access and migration helpers)
- Create: `src/features/academy/SavedLearningPanel.tsx` (proposed)
- Modify: `src/routes/learn.tsx` (observed)
- Test: `src/features/academy/savedLearning.test.ts` (proposed)
- Test: `src/features/academy/SavedLearningPanel.test.tsx` (proposed)

**Interfaces:**
- Table: `edu_saved_items` with owner `user_id`, item type (`course`, `lesson`, `resource`, `educator`), one corresponding UUID reference, and `saved_at`.
- Use one nullable foreign-key column per item kind with a CHECK requiring exactly the column matching `item_type` to be populated; add owner/type/item uniqueness constraints or partial unique indexes and cascading deletes.
- RLS: authenticated users may SELECT, INSERT, and DELETE only rows where `user_id = auth.uid()`; no client UPDATE is needed.
- Data helpers: `listSavedItems(userId)`, `saveLearningItem(userId, itemType, itemId)`, `unsaveLearningItem(userId, itemType, itemId)`, and `importLegacySavedCourses(userId, courseIds)`.
- `SavedLearningPanel` supports filters All Saved, Courses, Lessons, Resources, and Educators.

- [ ] **Step 1: Add focused failing tests**

Test that:
1. Each of the four item types can be saved and unsaved.
2. Duplicate saves are idempotent and do not create duplicate rows.
3. Saved items are returned only to their owner.
4. Each filter returns only its item type; All Saved returns all four.
5. A signed-out user's existing local saved-course list remains usable locally.
6. Legacy course IDs are imported without deleting local data before every import succeeds.
7. A deleted/missing referenced item is not rendered as a valid saved item.
8. Saving a restricted lesson/resource does not make its content or download available.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/features/academy/savedLearning.test.ts`

Expected: tests fail before saved-learning helpers exist.

- [ ] **Step 3: Implement the minimum behavior**

1. Create `edu_saved_items` with typed foreign keys, item-type constraint, uniqueness, RLS, and authenticated grants.
2. Do not reuse `user_saved_items`, which currently stores social post bookmarks.
3. Implement the data helpers and owner-scoped reads/writes.
4. Add one-tap save controls for courses, lessons, resources, and educator profiles.
5. Extend My Learning → Saved with All Saved, Courses, Lessons, Resources, and Educators filters.
6. For signed-in users, merge legacy `nexora-academy-saved-courses` IDs into the database. Keep local storage intact until the import has been confirmed successful; only then clear the legacy key. If import fails or partially succeeds, retain the local list and retry safely using idempotent upserts.
7. For signed-out users, retain the existing local saved-course behavior; do not pretend cross-device persistence is available.
8. When opening a saved lesson/resource, re-run existing enrollment, payment, and resource access checks. A saved item is only a bookmark, never an entitlement.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/features/academy/savedLearning.test.ts`

Expected: all saved-item, filter, migration, and access-boundary tests pass.

- [ ] **Step 5: Run the affected integration and security checks**

Run: `npm test -- src/features/academy/SavedLearningPanel.test.tsx`

Expected: save controls and My Learning filters work for signed-in and signed-out states. Verify RLS by attempting cross-user SELECT/INSERT/DELETE with two authenticated test accounts; each cross-user operation must return no rows or a permission error.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/learn.tsx src/features/academy/savedLearning.ts src/features/academy/SavedLearningPanel.tsx src/features/academy/savedLearning.test.ts src/features/academy/SavedLearningPanel.test.tsx supabase/migrations
git commit -m "feat: add persistent Academy saved learning"
```

---

### Task 4: End-to-end regression and release verification

**Files:**
- Modify only if required: `src/routes/learn.tsx`, `src/routes/profile-settings.tsx`, `src/features/academy/`
- Add: `src/features/academy/academy-discovery.integration.test.tsx` (proposed)

**Interfaces:**
- End-to-end user journey spans educator profile settings, public educator search, Showcase, canonical follow state, and `edu_saved_items`.
- Existing course enrollment, lesson player, progress, and resource library interfaces remain unchanged.

- [ ] **Step 1: Add the end-to-end regression test**

Cover this journey: mark a profile as Creator + Education, add education skills, make it public/discoverable, find it in Academy, open Showcase, follow it, save the educator, save one course/lesson/resource, then verify the Saved filters and persisted follow/saved state after remount.

Also cover negative cases: ordinary personal profile, non-education creator, private profile, non-discoverable profile, signed-out follow attempt, and restricted lesson/resource access.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/features/academy/academy-discovery.integration.test.tsx`

Expected: the journey test fails until all tasks are integrated.

- [ ] **Step 3: Fix only integration defects**

Keep component and data boundaries intact. Ensure educator search and Showcase call the safe public RPCs; saved-learning mutations remain owner-scoped; course playback and resource access continue through existing paths.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/features/academy/academy-discovery.integration.test.tsx`

Expected: all positive and negative user journeys pass.

- [ ] **Step 5: Run full repository checks**

Run: `npm test`

Expected: all Vitest tests pass.

Run: `npm run lint`

Expected: ESLint completes without errors.

Run: `npm run build`

Expected: Vite/Nitro production build completes successfully.

Run Supabase advisors and verify the educator RPC grants, `edu_saved_items` RLS policies, and no new public access to restricted Academy content.

- [ ] **Step 6: Commit the passing integration deliverable**

```bash
git add src/routes/learn.tsx src/routes/profile-settings.tsx src/features/academy
git commit -m "test: verify Academy educator discovery and saved learning"
```

## Unresolved implementation decisions

1. **Educator eligibility wording:** The current profile settings UI has a Creator account type and an Education & Lifestyle category (`profile_category = 'education'`), but no separate Instructor account type. Recommended initial eligibility is a public/discoverable profile with `profile_category = 'education'` and an education-capable account type; implementation should confirm whether Business + Education profiles should also appear. The user has not explicitly excluded them.
2. **Education skills UX:** The database has no dedicated skills column today. This plan recommends adding `education_skills text[]` and an editor in Profile Settings. Confirm whether free-form custom skills should be accepted in addition to the suggested chips.
3. **Public educator data access:** Current `profiles` RLS is owner-only. The exact secure read-only RPC implementation must be reviewed against current Supabase documentation and advisors before applying it; no broad public SELECT policy on `profiles` should be added.
