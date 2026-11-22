# Nexora User-Created Clubs & Football Match Center Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver user-created public/private Clubs & Guilds and a provider-ready, low-data Football Match Center without disrupting existing Nexora LIVE or existing club content.

**Architecture:** Extend the current clubs database and route with atomic owner creation, membership-safe directory access, and server-enforced visibility/role rules. Add a separate `/match-center` route backed by normalized Supabase cache tables, provider-neutral server ingestion, user favorite teams, explicit club sync, and deferred highlight loading. Existing `/live` remains unchanged; no paid API key is configured or subscription activated.

**Tech Stack:** React, TypeScript, TanStack Router, Supabase Postgres/RLS/RPC, Vercel Functions/Cron, Vitest, Bun.

## Global Constraints

- Preserve existing club rows, memberships, messages, events, RSVPs, and audit history.
- `g1`, `g2`, and `g3` must not be hard-coded as the selected or available client clubs.
- Any authenticated user can create a club and becomes its immutable Creator in the same transaction.
- The creator chooses Public or Private visibility. Private clubs and related records are not exposed to non-members/invitees.
- Creator/Admin/Moderator/Member role authority is enforced in Postgres, not only in UI.
- Payments remain out of scope.
- Do not replace or modify the existing `/live` streaming experience.
- Football data is server-ingested into cache tables; clients never call the upstream API directly.
- Do not fabricate scores or activate paid provider access. A provider key is optional and server-only; no key means honest empty/setup state.
- Live refresh cadence is constrained by configured provider quota and platform scheduling limits.
- Users explicitly choose which Nexora clubs receive favorite-team updates; no broadcast posting.
- Preserve unrelated existing worktree changes, especially generated `src/routeTree.gen.ts`; do not stage it unless the route generator itself updates it as part of this feature.

---

### Task 1: Secure user-created clubs

**Files:**

- Modify: `supabase/migrations/<generated migration>`
- Modify: `src/features/clubs/useClubData.ts`
- Modify: `src/routes/clubs.tsx`
- Test: `src/features/clubs/logic.test.ts`

**Interfaces:**

- RPC `create_club(p_name text, p_kind text, p_city text, p_venue text, p_blurb text, p_visibility text) returns text`.
- Existing `get_club_directory()` remains the directory entry point but returns only public clubs plus clubs the current user can access.

- [x] Add failing tests for empty directory selection and removal of the hard-coded `g1` selection.
- [x] Run focused tests and verify the missing-selection behavior fails before the helper is added.
- [x] Add additive club owner/visibility/invitation fields and secure database functions/policies; backfill existing creator membership without deleting any rows.
- [x] Add create-club form, visibility choice, invitation-link flow, empty state, and directory-driven selection.
- [x] Review existing production schema/policies and verify focused club tests and the production build; local SQL lint remains unavailable in this sandbox.

### Task 2: Football data contract and Match Center UI

**Files:**

- Create: `src/features/football/types.ts`
- Create: `src/features/football/format.ts`
- Create: `src/features/football/format.test.ts`
- Create: `src/features/football/useMatchCenter.ts`
- Create: `src/routes/match-center.tsx`
- Modify: generated `src/routeTree.gen.ts` only through the router generator

**Interfaces:**

- Normalized `FootballMatch`, `FootballAnnouncement`, and `FootballHighlight` types.
- Read-only hooks consume cached Supabase tables; no direct provider HTTP requests in the browser.

- [x] Add failing tests for match status formatting, competition filtering, stale-data presentation, and team-key normalization.
- [x] Run focused tests and verify the missing formatting/normalization behavior before implementation.
- [x] Implement normalized types, safe cache-read hooks, responsive score/news/highlight cards, Lite mode, and explicit empty states.
- [x] Generate the dedicated `/match-center` route and verify focused tests, new-file lint, and production build.

### Task 3: Football persistence and server ingestion boundary

**Files:**

- Modify: the generated Supabase migration from Task 1 or create a second generated migration
- Create: `api/football/sync.ts` (or the repository's established server-function location after inspecting Vite/Nitro conventions)
- Create: `src/features/football/provider.ts`
- Create: `src/features/football/provider.test.ts`
- Modify: `vercel.json` only if a supported Cron configuration is confirmed

**Interfaces:**

- Cache tables: `football_matches`, `football_announcements`, `football_highlights`.
- User tables: `football_favorite_teams`, `football_club_team_sync`.
- Provider adapter returns normalized records; writes are restricted to a server-only secret and trusted database client.

- [x] Add failing tests for provider normalization, malformed payload rejection, supported competition mapping, and status conversion; the database unique key enforces provider-ID deduplication.
- [x] Run focused tests and verify the adapter tests fail before the adapter is added.
- [x] Implement public read-only cache policies, private owner favorite policies, club-scoped sync preferences, and a server-only ingestion endpoint with bounded timeouts and stale-cache preservation.
- [ ] Activate Supabase Cron only after a provider key and a quota-capable plan are approved; the deployment instructions are documented, but no schedule or secrets are configured.
- [x] Review the RLS and migration SQL against the current Supabase schema and verify provider tests, new-file lint, and production build. Do not apply production migrations or add provider secrets in this task.

### Task 4: Favorite teams and club discussion integration

**Files:**

- Modify: `src/features/football/useMatchCenter.ts`
- Modify: `src/routes/match-center.tsx`
- Modify: existing club message integration only after verifying its message contract
- Test: `src/features/football/club-sharing.test.ts`

- [x] Add tests for active-member-only sharing and compact user-triggered match-card content.
- [x] Run focused sharing tests and verify active membership is required before a match card can be posted.
- [x] Implement favorite-team management, per-team/per-club opt-in, explicit disconnect controls, and “Discuss in Club” through the existing club message table.
- [x] Verify membership checks, focused tests, new-file lint, and production build.

### Task 5: Home/Explore previews and final verification

**Files:**

- Modify: existing Home/Explore feed entry point identified during implementation
- Create/modify: `docs/specs/` and `docs/plans/` documentation

- [x] Add compact cached Home previews and an Explore entry point without provider calls or automatic media downloads.
- [x] Run the full Vitest suite (46 files, 201 tests), new-file ESLint, and production build.
- [ ] Run local SQL lint/Supabase advisors on a non-production database; Docker/psql are unavailable in this sandbox, so the migration has been manually reviewed against the existing schema instead.
- [x] Inspect the final diff and stage only the new Match Center route entries from the pre-existing modified generated route file.
- [ ] Commit feature work and open a reviewable PR. Do not merge or deploy without a separate explicit instruction.


## Activation and verification caveats

- The database migration has not been applied to production, the Edge Function has not been deployed, and no Supabase Cron job has been scheduled.
- No API-Football key or paid subscription has been configured. The official pricing page currently lists 100 requests/day on Free and Pro at $19/month with 7,500 requests/day; confirm current quota/pricing and FKF competition coverage before approval.
- News and highlight cache tables/UI are ready, but source ingestion remains disabled until redistribution/embedding rights and official source feeds are selected.
- `bunx tsc --noEmit` remains blocked by pre-existing malformed syntax in `src/integrations/supabase/types.ts` (lines 245 and 1442); no errors were reported in the files changed for this feature.
