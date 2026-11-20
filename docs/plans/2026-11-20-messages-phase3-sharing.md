# Nexora Messages Phase 3: Attachments, Location Sharing, and Content Cards Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Nexora direct and group chats with private document attachments, one-time and time-limited live location sharing, and rich previews for shareable Nexora Posts, Reels, and Videos.

**Architecture:** Preserve the existing Messages and GroupChat flows, message tables, Nexora visual language, and private `chat-media` bucket. Add explicit typed message metadata and a private location-session model with participant-aware RLS; use browser geolocation only after a user action and only while the app is open. Content cards store references to existing Nexora content and must re-check the existing content visibility rules when rendered or opened.

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase JS, Supabase Postgres/RLS/Realtime/Storage, Vitest, Testing Library, existing shadcn UI and lucide-react icons.

## Global Constraints

- Work on branch `feature/messages-phase1-polish` and keep all Messages phases in the existing PR #51. Do not merge or deploy without separate explicit user approval.
- Retain the existing Nexora branding and theme; use the sample's clean, compact professional layout as a layout reference only.
- Preserve current direct-message and group-message behavior, read receipts, replies, reactions, and Realtime activity.
- The current private `chat-media` bucket has a 50 MiB limit and allows image, video, and audio MIME types only. Any document MIME extension must be narrow and explicit; do not make the bucket public or relax its existing object policies.
- Current direct-message RLS restricts reads to sender/recipient. Current group-message RLS restricts reads to current group members. Keep these boundaries for all new message types.
- `posts` currently allows SELECT for public audience or the author. `user_media_posts` currently allows SELECT for public content, the owner, and active creator subscribers for subscriber content. Do not bypass these policies or expose private media URLs.
- Live location is opt-in and foreground-only in the browser. Ask for browser permission only after the user presses Share location / Start live location. The user has approved one-time sharing and live durations of 15 minutes or 1 hour.
- Live location must stop on manual stop, selected expiry, permission loss, chat unmount/navigation, or geolocation failure. When the browser/app is closed or suspended, Nexora cannot promise continued tracking; recipients must see the last update timestamp and must never be shown a stale point as live.
- A live session may be read only by its sender and the intended direct recipient or current group members. No public location URLs, background tracking, or continuous tracking by default.
- No payments, Paystack, M-Pesa, transcription, smart replies, disappearing messages, chat lock, or call signaling are included in this Phase 3 plan.
- Do not add dependencies unless repository evidence shows the existing stack cannot implement the feature safely.

---

## Repository Evidence and Existing Interfaces

- Direct messages live in `public.direct_messages` with `sender_id`, `recipient_id`, `body`, `media_path`, `media_type`, `delivered_at`, `seen_at`, and `created_at`. The Phase 2 branch adds `reply_to_message_id`.
- Group messages live in `public.chat_group_messages` with `group_id`, `sender_id`, `body`, `media_path`, `media_type`, and `created_at`. The Phase 2 branch adds `reply_to_message_id`.
- Direct chat UI is in `src/routes/messages.tsx`; group chat UI is in `src/components/nexora/GroupChat.tsx`.
- Existing voice notes and media use the private `chat-media` bucket and signed URLs. Existing audio/image/video behavior must remain intact.
- The project test command is `npm test`; production build is `npm run build`; lint is `npm run lint`.

## Task 1: Typed Message Payloads and Private Document Attachments

**Files:**
- Modify: `supabase/migrations/<timestamp>_messages_attachments_and_location.sql` (create using the repository's Supabase migration workflow)
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Create: `src/components/nexora/MessageAttachment.tsx`
- Create: `src/components/nexora/message-attachments.test.ts`
- Modify: generated Supabase database types if the repository maintains them.

**Interfaces:**
- Direct and group message rows gain compatible nullable typed metadata for attachment display and shared-content references. Keep existing `media_path` / `media_type` semantics for image, video, and audio.
- `MessageAttachment` consumes a message attachment descriptor containing storage path, original filename, MIME type, and byte size; it produces a compact file card with file type, filename, formatted size, and an authenticated open/download action.
- File objects are uploaded to the existing private `chat-media` bucket. The storage object path must be namespaced by chat and sender; the database message is inserted only after successful upload.

- [ ] **Step 1: Add focused failing tests**

Test accepted document MIME types for PDF, DOC, DOCX, XLS, XLSX, PPT, and PPTX; reject executable, archive, HTML, and unknown MIME types. Test readable byte-size formatting, safe filename display, and missing signed URL behavior. Test that an upload failure creates no message row and that a message insert failure attempts to remove the just-uploaded object.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/components/nexora/message-attachments.test.ts`

Expected: the new tests fail because the typed document attachment descriptor and renderer do not exist yet.

- [ ] **Step 3: Implement the minimum behavior**

Add nullable attachment metadata to both message tables without changing existing media columns. Preserve the private bucket and existing object policies; extend its allowed MIME list only for the seven named document types and retain the current 50 MiB limit. Inspect existing Storage policies before any change; do not widen access. Add upload controls to both direct and group composers, render a compact attachment card, and create short-lived signed URLs only after the chat participant has loaded the message. Display a clear error when upload, message insert, signing, or download fails. Preserve existing photo, video, and audio upload paths.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/components/nexora/message-attachments.test.ts`

Expected: all attachment validation, formatting, and failure-path tests pass.

- [ ] **Step 5: Run affected integration checks**

Run: `npm test`, `npm run lint`, and `npm run build`.

Expected: the full test suite, lint, and production build pass with existing image/video/audio messaging unchanged.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add supabase/migrations src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora/MessageAttachment.tsx src/components/nexora/message-attachments.test.ts
git commit -m "feat: add private document attachments to messages"
```

## Task 2: One-Time Location and Time-Limited Live Location

**Files:**
- Modify: `supabase/migrations/<timestamp>_messages_attachments_and_location.sql` (same migration as Task 1 when implemented together)
- Create: `src/components/nexora/LocationShareCard.tsx`
- Create: `src/hooks/useChatLocationSharing.ts`
- Create: `src/components/nexora/location-sharing.test.ts`
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`

**Interfaces:**
- `useChatLocationSharing({ chatKind, chatId, userId })` exposes explicit `shareOnce()`, `startLiveSharing(durationMinutes)`, and `stopLiveSharing(sessionId)` actions plus active session state and last-update time.
- Supported live durations are exactly 15 and 60 minutes.
- A location payload contains latitude, longitude, optional accuracy, and captured timestamp. It must not include a user's profile details beyond the message sender already visible in the chat.
- `LocationShareCard` consumes a location payload or live-session summary and displays a map preview/link, the sender's update time, and live/expired/stopped status.

- [ ] **Step 1: Add focused failing tests**

Test that geolocation is not requested on component mount; it is requested only after explicit user action. Test one-time payload rendering, 15/60-minute expiry calculation, stop behavior, permission-denied behavior, unavailable-position behavior, and stale-update labeling. Test that a stopped or expired session is not treated as live and that chat teardown stops all geolocation watches.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/components/nexora/location-sharing.test.ts`

Expected: tests fail because the location hook, session model, and card do not exist yet.

- [ ] **Step 3: Implement the minimum behavior**

Add a private `chat_location_shares` table with chat kind, direct recipient or group ID, sender, start/expiry/stopped timestamps, and only the latest coordinate/accuracy/update timestamp. Add RLS policies that validate both sender identity and the intended chat participant relationship; group access must use the current group-membership predicate. Do not expose the table to anon. Use Realtime updates for authorized participants only. Enforce expiry and stopped status in database reads, not only in client presentation. The sender's browser uses `navigator.geolocation.watchPosition` only while the page is active and the session is valid; clear the watch on stop, expiry, visibility loss/unmount, permission error, or geolocation error. Use a 10-second minimum update throttle as an engineering recommendation to avoid excessive writes; never report a point as current when the update timestamp is stale. One-time shares are sent as ordinary chat message payloads and do not create a live session. Use an OpenStreetMap link for map opening; do not require an API key or transmit coordinates to an unrelated service. A client timer may update the countdown display, but database expiry remains authoritative.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/components/nexora/location-sharing.test.ts`

Expected: all permission, lifecycle, duration, and stale-state tests pass.

- [ ] **Step 5: Run affected integration and security checks**

Run: `npm test`, `npm run lint`, and `npm run build`. In Supabase, verify with separate authenticated identities that the sender and intended recipient/current group members can read a session, unrelated users cannot read or update it, former group members lose access, and stopped/expired sessions no longer return coordinates.

Expected: all application checks pass and every RLS isolation assertion returns the expected allow/deny result.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add supabase/migrations src/components/nexora/LocationShareCard.tsx src/hooks/useChatLocationSharing.ts src/components/nexora/location-sharing.test.ts src/routes/messages.tsx src/components/nexora/GroupChat.tsx
git commit -m "feat: add private time-limited chat location sharing"
```

## Task 3: Share Nexora Posts, Reels, and Videos as Rich Message Cards

**Files:**
- Modify: `supabase/migrations/<timestamp>_messages_attachments_and_location.sql` (same migration as Tasks 1–2 when implemented together)
- Create: `src/components/nexora/SharedContentCard.tsx`
- Create: `src/components/nexora/ShareContentDialog.tsx`
- Create: `src/components/nexora/shared-content.test.ts`
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`

**Interfaces:**
- Shared content metadata contains a content source (`posts` or `user_media_posts`), the original content UUID, and the content type used for its preview.
- `ShareContentDialog` lists only content the sender can currently select under existing RLS. It does not accept arbitrary media URLs or private storage paths from the client.
- `SharedContentCard` resolves the referenced row through the authenticated Supabase client and renders the creator, caption, safe thumbnail/preview, content type, and link to the canonical Nexora route.

- [ ] **Step 1: Add focused failing tests**

Test rendering for a public Post, Reel, and Video; missing/deleted content; unsupported content type; and content that becomes inaccessible after it was shared. Test that arbitrary URLs are rejected and no private storage path is rendered as a public URL.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/components/nexora/shared-content.test.ts`

Expected: tests fail because the content picker, typed reference payload, and preview card do not exist yet.

- [ ] **Step 3: Implement the minimum behavior**

Add nullable content-source and content-ID metadata to both message tables. Query `posts` and `user_media_posts` through existing RLS for the sender's picker; support the existing `post`, `reel`, and `video` content types and do not present unsupported or inaccessible items. Render shared content by resolving its reference under the recipient's own authenticated session. If the recipient cannot currently access the original item, render a neutral “Content unavailable” card without leaking caption, creator-only metadata, thumbnail URL, or media URL. Generate canonical in-app routes from the validated content source and ID; never accept a client-supplied destination URL. Respect public, owner-only, and subscriber audience rules as enforced by current RLS. For group chats, each member resolves the content independently under their own permissions.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/components/nexora/shared-content.test.ts`

Expected: all preview, inaccessible-content, and route-safety tests pass.

- [ ] **Step 5: Run affected integration checks**

Run: `npm test`, `npm run lint`, and `npm run build`.

Expected: existing direct and group chat tests pass, and the production build succeeds.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add supabase/migrations src/components/nexora/SharedContentCard.tsx src/components/nexora/ShareContentDialog.tsx src/components/nexora/shared-content.test.ts src/routes/messages.tsx src/components/nexora/GroupChat.tsx
git commit -m "feat: share Nexora content in messages"
```

## Task 4: End-to-End Chat Integration and Regression Verification

**Files:**
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Modify or create focused tests adjacent to the new attachment, location, and shared-content components.

**Interfaces:**
- Both direct and group chat composers expose the same three attachment actions: Document, Location, and Nexora content.
- Both chat timelines render all new typed message variants without disrupting current text, image, video, audio, reply, reaction, date-divider, and delivery/read-receipt behavior.

- [ ] **Step 1: Add focused integration tests**

Test each action in direct and group chats; verify sent messages appear in chronological order; verify reply and reaction controls remain available on eligible messages; verify the inbox preview shows meaningful labels for document, location, and shared content; verify signed document URLs expire and are refreshed only for current chat participants.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/routes/messages.test.tsx src/components/nexora/GroupChat.test.tsx`

Expected: tests fail only for the newly introduced composer actions and message variants before integration is implemented.

- [ ] **Step 3: Implement the minimum integration**

Unify the visible composer action labels and card styles while keeping direct and group persistence paths distinct. Ensure upload and send states disable duplicate submission. Keep permission prompts tied to a button click. Keep live-session controls visible to the sender and a clear active/last-updated state visible to recipients. On any message type that cannot load its metadata, render a safe fallback instead of crashing the timeline.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/routes/messages.test.tsx src/components/nexora/GroupChat.test.tsx`

Expected: the direct and group chat integration tests pass.

- [ ] **Step 5: Run final branch verification**

Run: `npm test`, `npm run lint`, and `npm run build`.

Expected: all tests pass, lint reports no errors, and the production build completes successfully. Also complete the Supabase RLS isolation checks in Tasks 1–3 before considering the feature ready.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora
git commit -m "feat: integrate phase three message sharing"
```

---

## Product Decisions Confirmed

- Preserve Nexora branding while using a cleaner professional Messages layout.
- Support one-time location sharing and live sharing for exactly 15 minutes or 1 hour.
- Live location updates only while Nexora is open and browser location permission remains enabled.
- Sender can stop immediately; sessions expire automatically; recipients see update freshness and cannot access stopped/expired coordinates.
- All Phase 3 work remains part of the existing Messages PR #51; merge and production deployment require separate explicit approval.

## Engineering Recommendations

- Keep the current 50 MiB private chat-media limit for documents.
- Throttle live coordinate writes to at most one update every 10 seconds while foregrounded.
- Use OpenStreetMap links for map opening to avoid API keys and external location SDK dependencies.
- Resolve shared content under each recipient's own RLS context instead of copying media URLs into messages.
- Prefer one additive migration for the Phase 3 schema changes, with no weakening of existing policies.
