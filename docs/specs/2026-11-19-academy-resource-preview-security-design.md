# Academy Resource Preview Security Design

**Date:** 2026-11-19  
**Repository:** `samwelnyabari0-cmd/nexora-super-app`  
**Status:** Proposed design; implementation and database changes require separate approval.

## 1. Context

The Academy resource details feature reads from `public.edu_resource_previews`. The currently applied migration created this object as a public-schema view owned by `postgres`, with `security_invoker = false`, so anonymous visitors can see metadata even though the underlying `edu_resources` table has restrictive row-level security (RLS).

The view returns only six metadata columns and does not include `r2_object_key`. Nevertheless, Supabase's security advisor correctly flags a public SECURITY DEFINER view because it bypasses the base table's RLS. The goal is to remove that flagged pattern without weakening private resource downloads.

## 2. Goals and non-goals

### Goals
- Allow visitors to read metadata for published resources in published courses.
- Keep storage object keys out of all public preview data.
- Keep enrolment and course-owner authorization on the existing `edu_resources` table.
- Preserve the frontend's existing `edu_resource_previews` relation and six-column response shape.
- Keep preview metadata synchronized with resource and course publication changes.
- Enable RLS on the replacement public table and grant only the access needed to read it.

### Non-goals
- Do not change the existing `edu_resources` RLS policies.
- Do not change the `academy-resources` Storage bucket or its enrolled/owner read policy.
- Do not expose draft or unpublished resources.
- Do not change the resource download flow, signed URL lifetime, or enrolment rules.
- Do not deploy the frontend or apply a new database migration as part of this design-document commit.

## 3. Proposed database design

Replace the current view with a regular table named `public.edu_resource_previews`. It will contain exactly these six columns:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | uuid | Resource identifier; primary key |
| `course_id` | uuid | Related course identifier |
| `resource_name` | text | Display name |
| `file_type` | text | Display file type |
| `file_size_bytes` | bigint | Display file size |
| `access_tier` | text | Access label shown in the preview |

The table must not contain `r2_object_key`, a signed URL, or any other storage locator. A foreign key to `edu_courses(id)` should cascade on course deletion so preview rows cannot become orphaned.

Enable RLS. Grant `SELECT` to `anon` and `authenticated`; do not grant either role write privileges. A SELECT policy may expose every row in this table because trusted synchronization logic will insert only metadata for resources whose course is published and whose resource publication status is published. No untrusted client may insert or change rows.

## 4. Trusted synchronization

Use narrowly scoped trigger functions in the existing non-exposed `private` schema. Functions that must write to the RLS-protected preview table should use `SECURITY DEFINER` only where required, set a fixed safe `search_path` (preferably empty with fully qualified object names), and have direct execution revoked from `PUBLIC`, `anon`, and `authenticated`. They are invoked by database triggers, not exposed as RPC endpoints.

- **Resource INSERT/UPDATE:** remove the prior preview row for that resource, then insert the six safe fields only if its course is published and its resource publication status is `published`.
- **Resource DELETE:** remove its preview row.
- **Course publication change:** refresh preview rows for that course. If the course is published, insert the metadata for its published resources; otherwise remove all preview rows for the course.
- **Existing publication-state triggers:** retain them. Attach synchronization as AFTER triggers so the preview reflects the final state after existing BEFORE publication-state logic has run.
- **Backfill:** populate the table from resources joined to courses that satisfy the same publication conditions.

The migration must be idempotent where practical, account for existing rows, and avoid changing the original resource or Storage policies.

## 5. Download authorization remains separate

The frontend continues to read preview metadata from `edu_resource_previews`. When a user requests a download, it separately selects `r2_object_key` from `edu_resources`. The existing `edu_resources_read_enrolled_or_owner` RLS policy must remain the authority for that lookup. Supabase Storage's existing `academy_resource_read_enrolled_or_owner` policy remains the authority for object access and signed URL creation.

The client-side access check is a usability guard only; it is not a security boundary. Database RLS and Storage policies remain authoritative.

## 6. Migration history reconciliation

The remote Supabase migration history records the already-applied migration as version `20261119183216` with name `academy_resource_preview_safe_metadata`. The repository migration filename currently uses a different timestamp. Reconcile the repository filename to:

`supabase/migrations/20261119183216_academy_resource_preview_safe_metadata.sql`

Do not re-apply the already executed migration and do not alter its SQL contents as part of the reconciliation. The replacement-table work belongs in a separate, later migration with a timestamp chosen after checking the latest remote migration history and using the repository's normal migration-generation workflow.

## 7. Verification plan

Before declaring the implementation complete:

1. Confirm the preview relation is a table, not a view.
2. Confirm it has exactly the six approved columns and no storage key.
3. Confirm RLS is enabled and public roles have SELECT but no write grants.
4. As an anonymous role, confirm published course/resource metadata is visible and draft/unpublished metadata is absent.
5. Confirm resource insert, metadata update, unpublish, republish, delete, and course publish/unpublish changes synchronize correctly.
6. Confirm an unauthorised user cannot read `r2_object_key` from `edu_resources`.
7. Confirm an enrolled learner and course owner retain their authorized resource-key lookup and Storage access.
8. Run Supabase security and performance advisors; review every remaining finding rather than suppressing it.
9. Run Academy tests, lint, TypeScript baseline checks, and the production build in CI.
10. Do not merge, apply the follow-up migration, or deploy until separately approved.

## 8. Risks and safeguards

- **Stale public metadata:** triggers must cover both resource changes and course publication changes; tests must exercise both directions.
- **Privilege escalation through trigger functions:** keep privileged functions in the non-exposed schema, use a fixed search path and fully qualified names, revoke direct execution, and inspect function ownership and grants.
- **Accidental key exposure:** enforce an exact six-column table schema and test that no key-like field is returned.
- **Migration drift:** reconcile the exact remote migration version before adding a later migration.
- **Download regression:** preserve existing base-table and Storage policies and test authorized and unauthorized paths independently.

## 9. Approval boundaries

This document records the proposed design only. A separate approval is required before implementation/PR creation, before applying the follow-up Supabase migration, and before any production deployment. No paid plan, billing change, or upgrade is part of this work.
