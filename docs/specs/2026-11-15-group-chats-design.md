# Nexora Group Chats Design

**Date:** 2026-11-15  
**Repository:** `samwelnyabari0-cmd/nexora-super-app`  
**Scope:** Add group conversations alongside existing one-to-one messaging.

## Goal

Allow Nexora users to create private group conversations, discover and add any user who is eligible for the existing public directory search, exchange text and media messages in real time, and manage membership through group-admin permissions without changing existing direct-message behavior.

## Approved product decisions

- Group conversations appear alongside existing private conversations in Messages.
- A group has a name, optional description, and optional photo.
- Group creators become admins.
- Group admins can add any discoverable Nexora user by name or handle, and can remove members.
- Ordinary members can participate and leave the group, but cannot add or remove other members.
- Only current group members can read group details, membership, and messages.
- Group messages support text and media, with sender display name, handle, avatar, and timestamp.
- Existing one-to-one messaging remains on its current tables and code path.

## Approaches considered

1. **Separate group-chat subsystem (selected):** Use the existing `chat_groups`, `chat_group_members`, and `chat_group_messages` tables and integrate them into the current Messages route. This minimizes risk to direct messages and uses the database work already completed.
2. **Unified conversation model:** Migrate direct and group chats into a common conversation schema. This could simplify future features but requires a broader migration and risks existing DMs.
3. **External chat service:** Delegate group messaging to another provider. This adds a service dependency and potential ongoing cost without being necessary for the current scope.

## Existing project context

- The current messaging entry point is `src/routes/messages.tsx`. It implements one-to-one conversations using `direct_messages`, including existing media handling and realtime updates.
- User discovery already uses the `search_directory` Supabase RPC, which returns discoverable users with `id`, `display_name`, and `handle`. The existing Explore and Calls routes demonstrate this convention.
- The group tables and baseline row-level security policies have already been created in the Nexora Supabase project. A security-definer helper approach in the `private` schema has also been added to avoid recursive RLS policy evaluation.
- Group tables are separate from direct-message tables. Existing private-chat behavior must not be rewritten as part of this feature.

## Architecture

The existing Messages route remains the user-facing entry point. Its inbox will show two conversation types: direct conversations and group conversations. Selecting a group opens a group view driven only by `chat_group_messages`; selecting a direct conversation continues to use the current `direct_messages` implementation.

Group-specific database operations use the three existing group tables. Membership and admin checks are enforced by PostgreSQL RLS and narrowly scoped database functions/RPCs, not only by hiding controls in the UI. The existing `private.is_group_member(uuid)` and `private.is_group_creator(uuid)` helpers are available; implementation must extend the authorization model so group admins (not just creators) can add/remove members according to the approved rules.

### Database responsibilities

- `chat_groups`: group identity, description, avatar path/URL, creator, creation time.
- `chat_group_members`: membership and `admin` / `member` role.
- `chat_group_messages`: group message body or media metadata, sender, and creation time.

Use transactional RPCs for operations that must be atomic:
- Create a group and insert its creator as the first admin in one transaction.
- Add a member only when the caller is an admin of that group; prevent duplicate membership.
- Remove a member only when the caller is an admin, subject to the product rule that an admin cannot remove themselves through the remove-member action; members can use Leave Group.
- Send group messages only when the sender is a current member and the sender ID matches `auth.uid()`.

The implementation must verify actual profile table/column names before writing sender-profile joins. It should reuse the app's established profile lookup conventions rather than assuming a schema.

### User discovery

Reuse `search_directory` with the same search input and returned user identity fields used by Explore/Calls. Only users returned by that RPC are eligible to be selected. Do not expose a separate unrestricted profile search.

### Media

Reuse the existing `chat-media` storage bucket and established upload/signed-URL approach where compatible. Group media access must be restricted to group members. Before using a group-specific storage path or policy, inspect the current bucket policies and ensure a user cannot retrieve another group's media by guessing a path. Preserve the existing direct-message upload behavior.

### Realtime

Subscribe to inserts for the selected group's messages and membership changes relevant to the current user's inbox/group view. Unsubscribe when leaving the group view or switching groups. Realtime events are a refresh mechanism; database RLS remains the source of authorization.

## User experience and behavior

### Messages inbox

- Keep existing direct-message rows and navigation working.
- Add group rows with group photo/name, latest message preview, and latest activity time.
- A group row opens the selected group conversation.
- Empty inbox behavior should remain understandable when a user has no conversations of either type.

### Create group

- Provide a create-group action from Messages.
- Collect group name, optional description, and optional photo.
- Allow selecting multiple discoverable users using name/handle search.
- Create the group and creator-admin membership atomically, then add selected members through the authorized membership operation.
- If adding one selected member fails, report which addition failed without silently implying that all selected members were added.

### Group conversation

- Show group name/photo and a members/details view.
- Render messages with sender display name, handle, avatar, and timestamp.
- Support text and media using the existing chat media conventions.
- Send button state and error feedback must reflect actual upload/insert results.
- A member who is removed or leaves must lose read access immediately through RLS, including realtime-backed reads.

### Member management

- Admins can search and add discoverable users.
- Admins can remove members.
- Ordinary members cannot see or invoke add/remove controls.
- Any attempted unauthorized operation must be rejected by the database even if a client bypasses the UI.
- Members can leave. The behavior when the last admin leaves is listed under unresolved decisions below.

## Proposed code boundaries

Observed path:
- Modify `src/routes/messages.tsx` to add group inbox rows and select between direct and group conversation views while preserving the direct-message branch.

Proposed paths (confirm existing project conventions before creating):
- `src/components/nexora/GroupChat.tsx`: group conversation UI, message list, composer, realtime subscription, and group header.
- `src/components/nexora/GroupChatInbox.tsx`: group inbox data loading and rows, if keeping this logic separate materially reduces the size of the Messages route.
- `src/components/nexora/CreateGroupDialog.tsx`: create-group form, directory search, and selected-user state.
- `src/components/nexora/GroupMembersDialog.tsx`: membership list and admin-only add/remove actions.
- Supabase migration under the repository's existing migrations directory: admin-aware helper/RPC and policy changes. The actual migration directory and naming convention must be verified before adding the file.

Avoid creating all proposed components if the repository's current component structure supports a smaller, clearer implementation. Do not refactor unrelated messaging code.

## Security and failure behavior

- RLS protects group rows, members, and messages.
- Use security-definer RPCs with a fixed safe search path and restricted execute grants for privileged multi-row operations.
- Verify caller identity with `auth.uid()` inside the database function; never trust a client-supplied sender or actor ID.
- A user who is not a member cannot list messages or members, even by calling Supabase directly.
- A non-admin cannot add/remove members, even by calling Supabase directly.
- Duplicate adds return a clear already-a-member result or a handled no-op; they must not create duplicate membership rows.
- If a user is removed while viewing a group, stop rendering newly received content and show that access has ended after the next authorization refresh.
- Upload failure must not create a message row pointing at a nonexistent object. Message insert failure after a successful upload should clean up the newly uploaded object when safe.
- Existing direct-message read, send, media, delivery, and notification flows must continue to work.

## Verification strategy

1. **Database authorization checks:** Test group creation, creator-admin membership, admin add/remove, member leave, duplicate add, non-admin add/remove denial, non-member read denial, and sender identity enforcement using authenticated test users.
2. **Directory selection:** Verify the picker only offers users returned by `search_directory`; verify search by display name and handle.
3. **Group messaging:** Verify text and media messages, sender identity display, timestamps, realtime delivery, and message ordering.
4. **Inbox integration:** Verify both group and direct conversations appear and open the correct view; verify existing direct-message send/read/media flows remain unchanged.
5. **Membership transitions:** Verify newly added members gain access, removed members lose access, and members can leave.
6. **Project checks:** Run the repository's actual package scripts for lint/typecheck/build after inspecting `package.json`. Do not claim a check passed unless its command completed successfully.

## Out of scope

- Group voice/video calls.
- Message reactions, replies, forwarding, polls, and pinned messages.
- Group invite links or public groups.
- End-to-end encryption changes.
- Replacing or migrating the existing direct-message system.

## Unresolved product decisions

These choices affect user-visible behavior and must be confirmed before implementation:
1. If the only remaining admin leaves, should the group be deleted, or should another member be promoted automatically?
2. Should group photo uploads be optional at launch (with a default group avatar), or should photo upload be required?
3. Should a removed/left member's previous messages remain visible to the remaining group, as normal chat history, or be deleted with that member's membership?
