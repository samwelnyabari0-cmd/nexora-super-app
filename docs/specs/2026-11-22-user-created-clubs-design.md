# User-Created Clubs & Guilds Design

## Goal

Replace the current fixed-seed club experience with a database-managed community directory where every authenticated user can create and own public or private clubs, invite or approve members, and delegate bounded roles without losing existing clubs or their content.

## Current repository context

- The current route is `src/routes/clubs.tsx`; it initializes the selected club with the literal ID `g1`.
- Club data is loaded through `src/features/clubs/useClubData.ts` and the `get_club_directory()` RPC.
- `public.clubs` currently stores basic club metadata and the initial migration inserts `g1`, `g2`, and `g3`.
- Membership roles already include `creator`, `admin`, `moderator`, and `member`; authorization helpers and restrictive policies exist in the Clubs migrations.
- The current working tree contains an unrelated generated-file change in `src/routeTree.gen.ts`. It must be preserved and not included in this feature's commits.

## Approved product behavior

- Any signed-in user can create a club.
- At creation, the creator chooses Public or Private visibility.
- Public clubs appear in discovery and accept join requests according to the existing membership flow.
- Private clubs do not appear in public discovery and are accessible through invitations; unauthorized users must not read private club details, members, events, or channels.
- The creator is the immutable owner. The creator can assign Admin, Moderator, and Member roles. Delegated roles cannot transfer ownership, demote/remove the creator, or grant permissions above their own authority.
- Preserve the three existing clubs, their memberships, messages, events, RSVPs, and audit history. They become ordinary rows in the dynamic directory, not hard-coded client choices.
- Users with no clubs see a useful empty state and a create/discover action; the route must not assume a default club ID.
- Existing Clubs & Guilds features (channels, announcements, pinned messages, unread state, events, RSVPs, and realtime updates) remain functional.
- Payments remain out of scope.

## Recommended architecture

1. Extend `public.clubs` with owner and visibility metadata using a backward-compatible migration. Backfill existing rows from the creator membership where possible; if historical rows have no creator membership, assign an explicit migration-owned fallback rather than deleting or guessing at user ownership.
2. Add an authenticated `create_club` database function that creates the club and its creator membership atomically. Use a server-generated ID; do not accept a caller-supplied creator identity.
3. Add narrowly scoped database functions for invitations, join requests, and role changes. Enforce authorization in Postgres, not only in React. Keep public directory reads limited to public clubs and authorized members/invitees.
4. Update `get_club_directory()` and the client hook to return only clubs the caller is allowed to discover or access. Keep stable ordering and return explicit membership/role information for the current user.
5. Replace the `g1` initial selection with URL/selection state derived from the loaded accessible clubs. Empty, loading, error, and no-access states must be distinct.
6. Add create-club and visibility controls to the existing Clubs route, reusing existing UI patterns and preserving current channel/event interfaces.

## Security and data rules

- RLS remains enabled on every club-owned table.
- Private club metadata and related records are not exposed by a permissive directory policy.
- Creator membership is created in the same transaction as the club row; a club cannot be left ownerless.
- Creator cannot leave or be demoted while the club exists. Ownership transfer is not part of this release.
- Admins and moderators may only perform actions explicitly allowed by database role checks; member role assignment is creator/admin-only unless the current schema has a narrower established rule.
- Invitation and membership mutations are auditable; no client can forge the actor ID.
- Existing rows and references are preserved through additive/backfill migrations. No destructive seed cleanup.

## Error and empty-state behavior

- Duplicate/invalid generated identifiers or name conflicts return a stable database error that the UI can explain and allow retry.
- A non-member opening a private club receives a not-found/unauthorized state without private metadata leakage.
- Failed creation leaves no orphan club or creator membership.
- A user with zero accessible clubs sees the empty state, not a broken selected-club panel.
- Realtime subscriptions are established only for clubs the current user can access and are cleaned up when selection changes.

## Verification

- Add database-level tests for atomic creation, creator membership, public/private visibility, join request/invite paths, role boundaries, and creator immutability.
- Add focused logic/component tests for empty directory state, no hard-coded `g1`, club selection, and visibility-specific actions.
- Run focused club tests, full test suite, lint for touched files, and production build.
- Apply migrations to a disposable/local database first; run Supabase advisors and explicit read/write probes before any production migration.

## Out of scope

- Club dues, subscriptions, payments, paid memberships, ownership transfer, and unrelated chat redesign.
