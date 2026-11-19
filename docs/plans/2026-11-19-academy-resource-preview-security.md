# Academy Resource Preview Security Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public SECURITY DEFINER metadata view with a regular RLS-protected metadata table while preserving public previews and authorised private downloads.

**Architecture:** Keep `public.edu_resource_previews` as the frontend-facing relation, but make it a six-column table with RLS and read-only grants for `anon` and `authenticated`. Private-schema trigger functions synchronize safe metadata after resource and course publication changes. Existing `edu_resources` RLS and `academy-resources` Storage policies remain the sole authority for private object-key and file access.

**Tech Stack:** PostgreSQL/Supabase migrations, row-level security, PL/pgSQL triggers, React, TypeScript, Vitest, ESLint, Vite/Nitro.

## Global Constraints

- Public preview metadata is limited to `id`, `course_id`, `resource_name`, `file_type`, `file_size_bytes`, and `access_tier`.
- Never expose `r2_object_key`, signed URLs, or other storage locators through the preview relation.
- Keep existing `edu_resources` RLS policies unchanged.
- Keep the `academy-resources` Storage bucket and its enrolled/owner read policy unchanged.
- Do not expose draft or unpublished resources or resources belonging to unpublished courses.
- Preserve the frontend's existing `edu_resource_previews` relation and six-column response shape.
- Keep the existing resource download flow and signed URL lifetime unchanged.
- Do not re-apply or alter the already-applied migration recorded remotely as version `20261119183216`.
- Apply the replacement-table migration only after explicit user approval.
- Do not merge or deploy until separately approved; do not upgrade or initiate paid services.

---

### Task 1: Reconcile the already-applied migration filename

**Files:**
- Rename: `supabase/migrations/20261119150000_academy_resource_preview_safe_metadata.sql`
- Preserve as: `supabase/migrations/20261119183216_academy_resource_preview_safe_metadata.sql`

**Interfaces:**
- Consumes: Existing migration SQL and remote Supabase migration version `20261119183216`.
- Produces: Repository filename aligned with the recorded remote migration version; SQL content remains byte-for-byte unchanged.

- [ ] **Step 1: Capture the current migration content and blob identity**

Fetch the existing migration from the implementation branch and record its content and blob SHA. Confirm the target filename does not already exist.

- [ ] **Step 2: Verify the expected mismatch**

Compare the current filename timestamp `20261119150000` with the already-verified remote history entry `20261119183216`. The mismatch is the reason for the rename; do not execute SQL.

- [ ] **Step 3: Rename without changing SQL**

Create a Git tree update that removes the old path and adds the new path using the exact same blob SHA. Do not recreate or edit the SQL text.

- [ ] **Step 4: Verify the rename**

Fetch both paths from the branch. Expected: old path is absent; new path exists; new file content exactly matches the captured original; remote migration history remains unchanged.

- [ ] **Step 5: Commit the independently reviewable change**

Commit only the migration rename with message `chore: align Academy preview migration history`.

### Task 2: Replace the privileged view with a synchronized metadata table

**Files:**
- Create: `supabase/migrations/<timestamp-later-than-20261119183216>_academy_resource_preview_rls_table.sql` (timestamp selected only after checking the latest remote migration history)
- Database objects: `public.edu_resource_previews`, narrowly scoped functions and triggers in `private`.

**Interfaces:**
- Consumes: Existing `public.edu_courses` and `public.edu_resources` schemas; their publication-state BEFORE triggers; existing private schema.
- Produces: A regular six-column `public.edu_resource_previews` table, RLS SELECT policy, and trigger-maintained metadata.

- [ ] **Step 1: Add focused database assertions before implementation**

Prepare repeatable SQL assertions for: relation kind is table; exact six-column schema; no storage key; RLS enabled; `anon` and `authenticated` have SELECT but no INSERT/UPDATE/DELETE privileges; published metadata is visible; unpublished metadata is absent.

- [ ] **Step 2: Verify the current failing state**

Run the relation/schema assertions against the current database before applying the replacement. Expected: relation-kind assertion reports a view, demonstrating the missing table-based design.

- [ ] **Step 3: Implement the replacement migration**

Within one migration transaction:
1. Create `public.edu_resource_previews` with `id uuid primary key`, `course_id uuid` referencing `public.edu_courses(id)` with `ON DELETE CASCADE`, `resource_name text`, `file_type text`, `file_size_bytes bigint`, and `access_tier text`.
2. Drop the existing view and create the table under the same public relation name.
3. Enable RLS. Grant `SELECT` to `anon` and `authenticated`; revoke public-role write privileges. Add a SELECT policy for those roles; no client write policy is created.
4. Create private-schema synchronization functions with fixed safe search paths and fully qualified object references. Use SECURITY DEFINER only for trigger functions that need to write to the RLS-protected preview table; revoke direct EXECUTE from `PUBLIC`, `anon`, and `authenticated`.
5. Add AFTER INSERT/UPDATE/DELETE synchronization on `edu_resources`. Rebuild the row from safe fields only when the resource and its course are both published; delete preview rows when the resource is unpublished or deleted.
6. Add an AFTER UPDATE synchronization trigger on `edu_courses` publication state. On publish, refresh previews for that course; on unpublish, remove its previews.
7. Preserve the existing BEFORE publication-state triggers and ensure the new AFTER triggers observe their final values.
8. Backfill currently published resources in published courses.
9. Do not modify base-table RLS or Storage policies.

- [ ] **Step 4: Verify the focused database assertions**

Run the assertions from Step 1. Expected: all schema, grant, RLS, and visibility assertions pass; no storage key exists in the preview table.

- [ ] **Step 5: Verify synchronization cases**

Use isolated test fixtures and clean them up afterward. Assert resource insert, metadata update, unpublish, republish, delete, course publish, and course unpublish all update preview rows correctly. Include a resource whose course is unpublished and verify it is not visible.

- [ ] **Step 6: Commit the migration deliverable**

Commit the migration and its SQL verification material with message `fix: secure Academy resource preview metadata`. Do not apply the migration to the remote project until the user explicitly approves.

### Task 3: Verify private downloads and frontend compatibility

**Files:**
- Inspect: `src/routes/learn.tsx`
- Inspect: `src/features/academy/resourceAccess.ts`
- Test: `src/features/academy/resourceAccess.test.ts`

**Interfaces:**
- Consumes: The six-column preview table response and existing `canAccessAcademyResource` / `mapAcademyResourcePreview` helpers.
- Produces: Verified safe preview mapping and separate authorised lookup of `r2_object_key` from `edu_resources`.

- [ ] **Step 1: Add or extend focused tests**

Assert that preview mapping returns exactly the six safe client fields even if an input object unexpectedly contains `r2_object_key`; retain access tests for enrolled learner, course owner, visitor, and unknown access tier.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run src/features/academy/resourceAccess.test.ts`

Expected: existing tests pass; any newly added assertion fails only if the mapper leaks a storage key or changes access behavior.

- [ ] **Step 3: Preserve the minimum frontend behavior**

Keep the preview query on `edu_resource_previews` and the separate download lookup on `edu_resources.select("r2_object_key")`. Do not add a key to the Resource type or metadata mapper. Keep the signed URL request against the existing `academy-resources` bucket.

- [ ] **Step 4: Verify the focused test**

Run: `npx vitest run src/features/academy/resourceAccess.test.ts`

Expected: all focused resource access and mapping assertions pass.

- [ ] **Step 5: Run integration checks**

Run: `npm test`, `npm run lint`, and `npm run build`. Also run the repository's existing TypeScript baseline audit in CI. Expected: all relevant Academy checks pass; any pre-existing unrelated baseline errors are reported separately, not silently treated as feature failures.

- [ ] **Step 6: Verify authorisation paths**

Using controlled test identities, assert an anonymous or non-enrolled user cannot select `r2_object_key`; an active/completed enrollee and course owner can retrieve the key under the unchanged table RLS; Storage access remains governed by the unchanged bucket policy. Do not use real learner records.

- [ ] **Step 7: Commit the verified compatibility deliverable**

Commit focused test/frontend changes with message `test: verify secure Academy resource downloads`.

## Unresolved externally observable decisions

- The exact timestamp for the replacement-table migration must be selected after querying the latest remote migration history immediately before implementation.
- Whether any remaining Supabase advisor findings unrelated to this feature should block the follow-up migration requires review of the actual advisor output; do not suppress findings automatically.
- Applying the new migration, merging the implementation PR, and deploying the frontend each require separate user approval.
