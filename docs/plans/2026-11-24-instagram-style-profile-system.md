# NEXORA Instagram-Style Profile System Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NEXORA profile navigation resolve the exact account UUID selected and present a consistent NEXORA-branded Instagram-inspired profile experience for owners and visitors.

**Architecture:** Keep `/profile` as the signed-in user's own-profile route. Add a canonical `/profile/id/$userId` route backed by a privacy-preserving `get_public_profile_by_id(p_user_id uuid)` RPC, and retain `/profile/$handle` as a compatibility adapter into the same profile experience. Update all other-account entry points to use UUIDs, and extract the shared profile identity/header presentation without replacing existing owner-only or visitor-only feature logic.

**Tech Stack:** React 19, TypeScript, TanStack Router file routes, Supabase Postgres RPCs and RLS, Supabase JS, Vitest, Testing Library, Bun, Vite.

## Global Constraints

- `/profile` always means the authenticated user's own profile.
- Every other-account link must carry that account's actual Supabase UUID; handles are display/search values, not canonical identity.
- A missing, malformed, inaccessible, or unknown other-account ID must never fall back to the signed-in user's profile.
- Preserve existing handle URLs as backward-compatible entry points.
- Preserve current discoverability/private-profile visibility rules and all private-content access checks; do not weaken RLS or expose owner-only settings.
- Owner-only controls remain visible only when authenticated user ID equals the loaded profile ID.
- Preserve existing NEXORA branding and existing supported profile features; do not copy Instagram branding.
- Do not update generated `src/routeTree.gen.ts` manually. Regenerate it using the repository's TanStack Router/Vite build workflow.
- Run focused Vitest tests, the full test suite, lint/type/build checks that are available, and verify the Vercel production deployment before claiming release success.
- Repository facts: `package.json` exposes `bun run test` (Vitest), `bun run lint`, and `bun run build`; `src/test/app-routing.test.tsx` is the existing route-matching test. The current feed store already populates `creatorId` from `posts.user_id`, while several UI links still use handles.

---

### Task 1: Add a secure UUID-based public profile lookup

**Files:**
- Create: `supabase/migrations/<timestamp>_public_profile_by_id.sql` (proposed; follow the repository's existing timestamped migration naming convention)
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/test/public-profile-lookup.test.ts` (proposed; add a database/RPC contract test using the existing test conventions, or a documented SQL verification script if no database test harness exists)

**Interfaces:**
- Consumes: existing `public.get_public_profile(p_handle text)` visibility contract and current `profiles` columns; authenticated caller identity via `auth.uid()`.
- Produces: `public.get_public_profile_by_id(p_user_id uuid)`, returning the same profile field shape needed by the existing public profile page: `id, display_name, handle, bio, private_profile, settings, avatar_url, account_type, profile_category, bio_links`.
- TypeScript RPC signature: `Args: { p_user_id: string }; Returns: ProfileRecord[]` with nullable database fields represented accurately.

- [ ] **Step 1: Add focused lookup contract tests**

Assert that:
1. A discoverable public profile is returned for its UUID with the requested UUID unchanged.
2. A profile with private/non-discoverable visibility is returned only under the same conditions allowed by the existing `get_public_profile` function (including owner access).
3. Owner-only `settings` are returned only when `auth.uid() = p_user_id`; non-owner callers receive an empty JSON object.
4. Unknown UUID returns zero rows.
5. The function does not return posts or any data outside the approved profile field set.

- [ ] **Step 2: Verify the focused tests fail before the RPC exists**

Run: `bun run test -- src/test/public-profile-lookup.test.ts`

Expected: the lookup contract test reports that the new RPC is unavailable or the expected contract is not met.

- [ ] **Step 3: Implement the migration and generated type**

Create a stable, `SECURITY DEFINER` SQL function with a fixed safe search path. Match the current handle-based visibility predicate: discoverable profile OR non-private profile OR caller is owner; retain suspended-account restrictions used by the existing public profile function. Return owner-only settings only for the owner, and otherwise return an empty object. Restrict execute privileges to the same caller classes intended by the current public profile lookup. Do not change table RLS policies. Add the exact function signature to `src/integrations/supabase/types.ts`.

- [ ] **Step 4: Verify the focused lookup contract**

Run: `bun run test -- src/test/public-profile-lookup.test.ts`

Expected: all lookup contract assertions pass. Apply the migration to the linked Supabase project through the repository's established migration process, then run direct SQL checks as anonymous, authenticated non-owner, and owner callers where the environment supports those roles.

- [ ] **Step 5: Run affected integration checks**

Run: `bun run lint`

Expected: no lint errors introduced by the new RPC type or test.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add supabase/migrations src/integrations/supabase/types.ts src/test/public-profile-lookup.test.ts
git commit -m "feat: add secure profile lookup by user id"
```

### Task 2: Add canonical ID routing and preserve handle compatibility

**Files:**
- Create: `src/routes/profile.id.$userId.tsx` (proposed TanStack file route for `/profile/id/$userId`)
- Modify: `src/routes/profile.$handle.tsx`
- Modify: `src/test/app-routing.test.tsx`
- Modify: `src/integrations/supabase/types.ts` only if Task 1's generated type signature needs a route-facing adjustment
- Generated: `src/routeTree.gen.ts` (generated by the router build/plugin; do not hand-edit)

**Interfaces:**
- Consumes: `get_public_profile_by_id(p_user_id: string)` from Task 1; existing public profile rendering and profile post/relationship queries.
- Produces: canonical route `/profile/id/$userId`; a route-level profile identity contract that passes the UUID to the existing public profile data/rendering layer.
- Compatibility: `/profile/$handle` resolves the handle with existing `get_public_profile(p_handle)`, then renders the same account view using the returned UUID; it never redirects to `/profile` as a fallback.

- [ ] **Step 1: Add failing route and identity tests**

Extend route tests to assert:
1. `/profile` matches the owner route.
2. `/profile/id/00000000-0000-0000-0000-000000000001` matches the new ID route.
3. `/profile/someone` still matches the handle compatibility route.
4. An invalid ID is rejected by the ID route's parser/loader and renders an unavailable state, not the own-profile route.
5. Changing from one UUID to another resets profile-specific state so the previous account's posts or selected content are not retained.

- [ ] **Step 2: Verify route tests fail before implementation**

Run: `bun run test -- src/test/app-routing.test.tsx`

Expected: the ID route match fails because the route is not registered.

- [ ] **Step 3: Implement the canonical route and shared profile data entry**

Create the ID route with UUID format validation before RPC invocation. Use the new RPC to load the exact profile and pass its UUID into the profile page data loader. Refactor the current `PublicProfile` component only as needed so both route adapters enter the same profile renderer and account-specific state is keyed/reset by UUID. Keep `/profile` route logic unchanged as the own-profile entry point. In the handle route, retain exact handle lookup, then pass the resolved profile ID into the same renderer. An empty handle, invalid UUID, no row, or RPC error must render an explicit unavailable/retry state without loading `OwnProfile`.

- [ ] **Step 4: Verify focused routing and identity tests**

Run: `bun run test -- src/test/app-routing.test.tsx`

Expected: owner route, canonical ID route, and legacy handle route all match their expected route IDs; invalid IDs do not resolve to the owner route.

- [ ] **Step 5: Regenerate routes and run integration checks**

Run: `bun run build`

Expected: TanStack Router regenerates `src/routeTree.gen.ts` and the production build completes without route type errors. If the build command fails, record the exact failure and fix only issues introduced by this task before proceeding.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/profile.id.\$userId.tsx 'src/routes/profile.\$handle.tsx' src/test/app-routing.test.tsx src/routeTree.gen.ts
git commit -m "feat: add id-based public profile route"
```

### Task 3: Move all other-account navigation to UUIDs

**Files:**
- Modify: `src/components/nexora/PostCard.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/explore.tsx`
- Modify: `src/routes/reels.tsx`
- Modify: `src/routes/videos.tsx`
- Modify: `src/routes/profile.tsx` (owner's followers/following account rows)
- Modify: `src/routes/profile.$handle.tsx` (public profile followers/following account rows)
- Modify: `src/components/nexora/GroupChat.tsx` (sender identity links)
- Modify any additional profile-link sites found by repository-wide search for `/profile/$handle`, `/profile/${`, or direct handle-derived profile URLs.

**Interfaces:**
- Consumes: canonical route `/profile/id/$userId`; UUID-bearing account fields such as `Post.creatorId`, directory `person.id`, media `item.user_id`, follower/following `connection.id`, and message sender user ID.
- Produces: a shared helper `profilePathForUser(userId: string | null | undefined): string | null` in proposed `src/lib/profile-navigation.ts`; it returns the ID route for a non-empty account UUID and `null` when identity is unavailable. Callers render non-clickable identity when it returns null. The helper must never return `/profile`.

- [ ] **Step 1: Add failing navigation helper and component tests**

Assert that:
1. A valid UUID maps to `/profile/id/<same UUID>`.
2. Null, undefined, or empty IDs map to `null`, never `/profile`.
3. PostCard links by `post.creatorId`, not by `creatorHandle`.
4. Explore and home creator cards link by `person.id`.
5. Reels and videos link by media `user_id`, even if the handle is missing.
6. Followers/following and GroupChat sender links use the corresponding row/sender UUID.

- [ ] **Step 2: Verify focused navigation tests fail before implementation**

Run: `bun run test -- src/test/profile-navigation.test.tsx`

Expected: UUID helper and entry-point assertions fail while current links are handle-based.

- [ ] **Step 3: Implement the helper and update entry points**

Create `profilePathForUser`. Replace handle-based navigation with UUID route navigation at every discovered entry point. In PostCard, use the actual post creator ID and preserve the current own-profile identity behavior for the signed-in user's own content only where the user explicitly selects that account; never substitute a missing ID. In reels/videos, use media `user_id` directly and render the creator identity without a link if absent. Update GroupChat sender links using the sender's UUID even when the sender has no handle. Update follower/following links using connection IDs. Leave the bottom Profile tab and all intentional owner navigation on `/profile`.

- [ ] **Step 4: Verify focused navigation tests**

Run: `bun run test -- src/test/profile-navigation.test.tsx`

Expected: every valid account link uses its selected UUID; every missing-ID case has no profile link; no other-user entry point resolves to `/profile`.

- [ ] **Step 5: Run repository search and integration checks**

Search source files for remaining handle-based profile links and inspect each remaining match. Remaining `/profile/$handle` usage is permitted only in the legacy compatibility route and tests. Run: `bun run test`

Expected: all existing and new Vitest tests pass.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/components/nexora/PostCard.tsx src/routes/index.tsx src/routes/explore.tsx src/routes/reels.tsx src/routes/videos.tsx src/routes/profile.tsx 'src/routes/profile.\$handle.tsx' src/components/nexora/GroupChat.tsx src/lib/profile-navigation.ts src/test/profile-navigation.test.tsx
git commit -m "fix: route creator links by account id"
```

### Task 4: Align own and public profiles with one shared profile presentation

**Files:**
- Create: `src/components/nexora/ProfileIdentityHeader.tsx` (proposed shared presentation component)
- Modify: `src/routes/profile.tsx`
- Modify: `src/routes/profile.$handle.tsx`
- Modify: `src/components/nexora/PublicProfileTabs.tsx` only if needed to align the shared Posts/Reels/Videos tab presentation
- Test: `src/test/profile-presentation.test.tsx` (proposed)

**Interfaces:**
- Consumes: typed profile identity fields `id, display_name, handle, avatar_url, bio`, follower/following/post counts, owner flag, and caller-provided action slots.
- Produces: `ProfileIdentityHeader` props: `profile`, `counts`, `isOwner`, `primaryActions`, and optional `secondaryActions`. The component renders the shared responsive avatar/name/handle/bio/count layout; route components retain ownership of edit/follow/message behavior and data permissions.

- [ ] **Step 1: Add failing shared-presentation tests**

Assert that:
1. Owner and visitor views render the same identity/count structure.
2. Owner view can render Edit Profile/account-owner actions.
3. Visitor view can render Follow and Message actions but never owner-only edit/settings controls.
4. Missing optional avatar, bio, or handle does not break layout.
5. Narrow/mobile viewport layout keeps counts and actions visible without horizontal overlap.

- [ ] **Step 2: Verify the focused presentation tests fail before implementation**

Run: `bun run test -- src/test/profile-presentation.test.tsx`

Expected: tests fail because the shared presentation component does not yet exist.

- [ ] **Step 3: Implement the shared header and integrate both profile routes**

Extract only the common identity and counts presentation. Keep owner editing, privacy settings, Pulse Passport, Creator Studio, saved content, and other owner controls in `OwnProfile`. Keep visitor follow/message behavior, public content filtering, and visitor permissions in the public profile route. Align content navigation labels/sections to Posts, Reels, and Videos while retaining existing additional supported tabs where currently used. Ensure responsive wrapping/scrolling prevents overlapping controls and preserve independent content scrolling.

- [ ] **Step 4: Verify focused presentation tests**

Run: `bun run test -- src/test/profile-presentation.test.tsx`

Expected: shared structure appears for both contexts; owner-only actions are absent for visitors; responsive layout assertions pass.

- [ ] **Step 5: Run full verification**

Run:
```bash
bun run test
bun run lint
bun run build
```

Expected: all Vitest tests pass, lint reports no new errors, and the Vite/Nitro production build completes. Then inspect the latest Vercel production deployment for the commit and confirm its state is `READY`. If the GitHub-connected workflow cannot run Bun commands locally, rely on actual Vercel build events and report the test/lint limitation rather than claiming they passed.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/components/nexora/ProfileIdentityHeader.tsx src/routes/profile.tsx 'src/routes/profile.\$handle.tsx' src/components/nexora/PublicProfileTabs.tsx src/test/profile-presentation.test.tsx
git commit -m "feat: unify nexora profile identity presentation"
```

## Unresolved product decisions

- None block implementation. The canonical route, lookup visibility contract, missing-ID behavior, owner/visitor actions, compatibility behavior, and verification expectations are specified above.
- Engineering recommendation: preserve the current database visibility predicate exactly for the new UUID RPC rather than introducing a new privacy model during this fix.
