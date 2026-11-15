# Nexora Group Chats Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure group conversations to Nexora alongside existing direct messages, using the group tables already created in the Nexora Supabase project.

**Architecture:** Keep `direct_messages` and its current UI path intact. Add group operations over `chat_groups`, `chat_group_members`, and `chat_group_messages`, integrate both conversation types in the existing Messages route, and enforce membership/admin permissions in PostgreSQL as well as the UI.

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase JS/Postgres RLS/Realtime/Storage, Vitest, ESLint, Vite/Nitro for Vercel.

## Global Constraints

- Group chats use a separate subsystem; do not migrate or rewrite direct messages.
- Any user returned by the existing `search_directory` RPC may be selected.
- Group photos and descriptions are optional; show a default group avatar when no photo exists.
- The creator is the initial admin.
- Only admins can add or remove other members. Ordinary members can send messages and leave.
- If the only admin leaves and other members remain, promote the longest-standing member (earliest `joined_at`) to admin. Use a stable deterministic tie-breaker for equal timestamps.
- If the final member leaves, retain the now-empty group record and its message history for possible recovery; it remains inaccessible to ordinary users until an authorized recovery path is defined.
- Only current members can read group details, membership, and messages.
- Previously sent messages remain visible to remaining members after their sender leaves or is removed; departed users lose access.
- Support text, image, video, and audio attachments consistently with the existing chat media conventions where secure storage access can be established.
- Group inbox and realtime updates must not break existing direct-message behavior.
- Never claim tests, deployments, or live behavior succeeded unless the corresponding check actually completed.

---

### Task 1: Secure transactional group operations

**Files:**
- Modify: Supabase migration file under the repository's existing migration directory (directory and naming convention must be confirmed before creation).
- Test: Proposed database integration tests or SQL verification script alongside the repository's established test conventions.

**Interfaces:**
- Consumes existing tables: `public.chat_groups`, `public.chat_group_members`, `public.chat_group_messages`.
- Consumes existing helpers: `private.is_group_member(uuid)`, `private.is_group_creator(uuid)`.
- Produces admin-aware authorization helpers and transactional RPCs for create, add, remove, and leave operations.

- [ ] **Step 1: Add failing authorization/integration cases**

Create authenticated-user cases covering:
1. Creator creates a group and is inserted as its first admin.
2. An admin adds a discoverable user.
3. A non-admin cannot add or remove members.
4. An admin removes a member.
5. A member leaves and loses access.
6. A removed/left member cannot read group messages or membership.
7. Remaining members can still read messages sent by a departed member.
8. A sender cannot insert a message as another user.
9. Duplicate membership insertion does not create a second row.
10. When the only admin leaves and members remain, the earliest-joined remaining member becomes admin.
11. Equal `joined_at` values resolve deterministically.
12. Leaving an already removed group is rejected without changing another member's state.

- [ ] **Step 2: Verify the relevant failure**

Run the database test harness selected after checking repository conventions. Expected: cases requiring admin-aware add/remove, atomic leave/succession, and the approved history behavior fail against the current creator-only policies or missing operations.

- [ ] **Step 3: Implement minimum database behavior**

Add fixed-search-path security-definer functions with restricted execute grants. Derive the actor from `auth.uid()`; do not trust caller-supplied actor IDs. Use transactions for group creation and creator membership, membership changes, and leave/admin succession. Add an admin helper that checks current membership role. Update RLS to allow current members to read group content, admins to manage membership, and only current members to send messages as themselves. Preserve message rows when a member departs. Keep group rows private to current members.

For succession, lock the group/member rows during the leave transaction, select the remaining member with earliest `joined_at`, and use a stable secondary key (for example member row UUID) for ties. Promote that member before completing the departing admin's removal. Do not promote a member who is also leaving.

- [ ] **Step 4: Verify focused database cases**

Run the same database cases. Expected: every authorization and transaction case above passes, including direct SQL attempts by a non-admin and reads by a departed member.

- [ ] **Step 5: Verify existing database behavior**

Re-run existing direct-message permission and notification checks if available. Expected: no direct-message policy or table is modified by the group migration.

- [ ] **Step 6: Commit the passing deliverable**

Commit only the migration and its focused database tests/scripts with message `feat: secure group membership operations`.

### Task 2: Group creation and discoverable member selection

**Files:**
- Create (proposed): `src/components/nexora/CreateGroupDialog.tsx`.
- Modify (observed): `src/routes/messages.tsx`.
- Test: Proposed component tests using the repository's Vitest and Testing Library setup.

**Interfaces:**
- Consumes `supabase.rpc("search_directory", { q })`, which existing `src/routes/explore.tsx` uses and which returns discoverable user identity fields including `id`, `display_name`, and `handle`.
- Consumes the Task 1 create-group and add-member RPC signatures.
- Produces a created group ID and a list of successfully added member IDs for inbox navigation and feedback.

- [ ] **Step 1: Add failing picker/form tests**

Cover search by display name and handle, minimum two-character search behavior consistent with Explore, selection and deselection of multiple people, exclusion of the signed-in user, optional description, optional photo, default avatar when photo is absent, create-submit loading state, and partial member-add failure reporting.

- [ ] **Step 2: Verify the relevant failure**

Run the focused Vitest file. Expected: tests fail because the group creation/picker UI does not yet exist.

- [ ] **Step 3: Implement group creation UI**

Reuse the existing directory RPC; do not query unrestricted profile tables for discovery. Add selected-user chips/list, group name, optional description and optional image. Create the group and creator-admin membership atomically. Add selected users using the authorized membership RPC. If one or more additions fail after group creation, keep the group, report exactly which additions failed, and allow the creator to continue managing the group. Show a default group avatar when no image is selected.

- [ ] **Step 4: Verify focused UI tests**

Run the focused Vitest file. Expected: selection, optional photo, submission, loading, and partial failure cases pass.

- [ ] **Step 5: Run integration checks**

Run `npm test` and `npm run lint`. Expected: focused tests and existing checks pass without changes to direct-message behavior.

- [ ] **Step 6: Commit the passing deliverable**

Commit the dialog and its tests with message `feat: add group creation and member picker`.

### Task 3: Group conversation, membership management, and media

**Files:**
- Create (proposed): `src/components/nexora/GroupChat.tsx`.
- Create (proposed): `src/components/nexora/GroupMembersDialog.tsx`.
- Modify only if required: Supabase migration/storage policy file under the verified migration convention.
- Test: Proposed focused Vitest component tests and database/storage authorization checks.

**Interfaces:**
- Consumes Task 1 group membership/message authorization operations.
- Consumes `chat_group_messages` and `chat_group_members`.
- Consumes the existing `chat-media` bucket conventions used by `src/routes/messages.tsx`.
- Produces group message rendering, composer submission, member details, admin actions, and membership/realtime state.

- [ ] **Step 1: Add failing conversation/member tests**

Cover ordered text messages, sender identity and timestamp rendering, empty state, sending disabled while pending, failed send feedback, admin-only add/remove controls, ordinary-member leave control, loss of access after removal, and realtime subscription cleanup on group switch/unmount.

- [ ] **Step 2: Verify the relevant failure**

Run the focused Vitest files. Expected: tests fail because group conversation and member management components are not present.

- [ ] **Step 3: Inspect storage authorization before implementing uploads**

Inspect the actual `chat-media` bucket policies and object path conventions. Do not assume the existing per-user direct-message path grants safe group access. Add group-scoped object authorization only if it can reliably verify current group membership for the object's group ID. If that cannot be proven with the current bucket design, keep group media sending disabled rather than exposing private media; text messaging must remain usable.

- [ ] **Step 4: Implement group conversation and member management**

Render sender display name, handle, avatar and timestamp using verified profile lookup conventions. Subscribe only to the selected group's messages and relevant membership changes; unsubscribe on switch/unmount. Use RLS as the source of truth. Admins can add discoverable users and remove members; members can leave. Preserve historical message rows after departures. On access loss, stop showing newly loaded content and return to the inbox with an access-ended message.

- [ ] **Step 5: Verify focused tests and authorization**

Run focused Vitest cases and database/storage authorization checks. Expected: message order, sender identity, realtime cleanup, role controls and access revocation pass. Verify that a removed user cannot obtain new signed URLs or read group media.

- [ ] **Step 6: Commit the passing deliverable**

Commit components and focused tests with message `feat: add group conversations and member management`.

### Task 4: Integrate groups into the Messages inbox

**Files:**
- Modify (observed): `src/routes/messages.tsx`.
- Modify (proposed): `src/components/nexora/GroupChat.tsx` only if a route integration contract needs adjustment.
- Test: Proposed Messages route tests.

**Interfaces:**
- Consumes the existing direct inbox data and direct-message route search parameter `recipient`.
- Consumes group membership/inbox data and a distinct group selection search parameter (proposed: `group`).
- Produces a combined inbox and routes each row to the correct direct or group view.

- [ ] **Step 1: Add failing inbox regression tests**

Cover direct-only inbox, group-only inbox, mixed inbox, empty inbox, opening a group, opening a direct conversation, and preserving the existing `recipient` / `returnTo` direct-message search behavior.

- [ ] **Step 2: Verify the relevant failure**

Run the focused route tests. Expected: group rows and group selection fail while existing direct-message cases remain green.

- [ ] **Step 3: Implement combined inbox integration**

Load only groups for which the current user has a membership row. Include group name/photo, latest message preview and latest activity time. Merge and sort direct and group conversation rows by latest activity without changing the existing direct-message query/send/receipt paths. Use a distinct group route state so direct and group IDs cannot be confused.

- [ ] **Step 4: Verify focused route tests**

Run focused route tests. Expected: direct and group rows open the correct view and sort correctly; empty and mixed inboxes render correctly.

- [ ] **Step 5: Run full project checks**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: all test suites pass, ESLint reports no errors, and the Vercel-targeted production build completes. Also manually verify direct message send/read/media/receipt and group create/add/send/leave/remove/succession flows with at least three authenticated test users.

- [ ] **Step 6: Commit the passing deliverable**

Commit the route integration and tests with message `feat: integrate group chats into messages inbox`.

## Remaining technical verification

- Confirm whether the existing `chat-media` bucket policies can securely support group-scoped objects. This is a technical verification gate; if they cannot, ship text-only group messaging until secure group media storage is available.
