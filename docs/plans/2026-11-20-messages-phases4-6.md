# Nexora Messages Phases 4–6: Calls, Advanced Messaging, and Final QA

**Branch:** `feature/messages-phase1-polish`  
**Pull request:** #51  
**Goal:** Complete the remaining Messages upgrade in the existing PR without replacing Nexora's current calling, AI, messaging, or privacy foundations.

## Repository facts confirmed

- Direct one-to-one calling already exists in `src/routes/calls.tsx`: `call_invites`, contact authorization, PeerJS signaling, browser media capture, and optional TURN configuration.
- Calls currently lack in-call mute, camera toggle, camera switching, speaker/output controls, and direct entry from a conversation header.
- The current direct-call signaling path uses public PeerJS signaling and Google STUN; TURN is optional. Calls can fail on restrictive networks when TURN is not configured. Never describe this as guaranteed connectivity.
- Authenticated voice transcription already exists as `aiTranscribe` in `src/lib/ai.functions.ts`; it uses the server-side Groq integration and requires `GROQ_API_KEY`. It currently returns a transcript and summary.
- Authenticated AI chat already exists as `aiChat`; smart replies can reuse it, but only after a user explicitly requests suggestions. Explain that the selected conversation text is sent to the configured AI provider; never send it automatically.
- The current chat schema is direct/group messages with RLS. New controls must not weaken participant or group-member access.
- Project commands in `package.json`: `npm test`, `npm run lint`, `npm run build`.

## Phase 4 — Voice and video calls

### Scope
- Add voice/video call actions to the direct conversation header, routed through the existing accepted-contact call flow.
- Improve the existing in-call panel with mute/unmute, camera on/off, camera switch where supported, and clear call status.
- Ensure remote audio is actually rendered for voice-only calls and media tracks are stopped on hang-up, decline, failure, and unmount.
- Keep incoming accept/decline and caller cancel behavior.
- Use TURN when configured; show a useful connection failure state when relay connectivity is unavailable.
- Preserve the existing `call_invites` RLS and transition guard. Do not expose peer IDs or call metadata to unrelated users.
- Do not add group calling by pretending a direct call is a group call. If group calls are added, use the existing Jitsi room path with a clearly disclosed external service and an explicit share/join action.

### Acceptance checks
- Accepted contacts can start audio/video calls from a direct chat.
- Recipient sees incoming call and can accept or decline.
- Audio and video are bi-directional; mute/camera controls affect local tracks.
- Call termination releases all media tracks and updates the invite status.
- Unaccepted contacts and unrelated users cannot create or read call invites.

## Phase 5 — Advanced messaging

### Disappearing messages
- Add explicit per-message or per-chat expiry choices, with a clear default of Off.
- Persist an authoritative `expires_at` timestamp and enforce visibility on reads; do not rely on client timers alone.
- Add a database cleanup mechanism only after confirming the required Supabase scheduling extension is available. If automatic physical deletion cannot be safely guaranteed, clearly distinguish expired/hidden messages from deleted data.
- Preserve RLS and prevent expired content from appearing in inbox previews, realtime updates, exports, or reply snippets.

### Chat lock
- Add an optional per-device app-level lock for a conversation, with a clear explanation that it is a privacy screen on that device, not end-to-end encryption and not a replacement for account authentication.
- Do not store a plaintext PIN or claim protection against a compromised device/browser.
- Lock before loading/rendering protected message content; provide recovery behavior that does not destroy messages.

### Voice transcription
- Reuse `aiTranscribe`, show a user-triggered Transcribe action on audio messages, and render the returned text only after success.
- Disclose that audio is sent to the configured AI provider for transcription. Respect the existing 20 MiB server limit and report missing-key/rate-limit errors clearly.
- Do not transcribe automatically.

### Smart replies
- Offer opt-in suggestions only after the user taps the action.
- Send only the minimum recent conversation context needed; explain that it is processed by the configured AI provider.
- Suggestions remain editable drafts and are never sent automatically.
- Gracefully disable the action if the AI key is unavailable or rate-limited.

### Acceptance checks
- Expiry Off preserves existing messages; selected expiry is enforced consistently for both direct and group messages.
- Locked chats require local unlock before message content is rendered and explain the local-device limitation.
- Transcription is explicit, bounded, and handles provider errors.
- Smart replies are opt-in, editable, and never auto-send.
- No new policy permits access outside direct participants/current group members.

## Phase 6 — Final polish and QA

- Audit Android-width layouts for inbox, direct/group chat, composer, call controls, attachment cards, location cards, and dialogs.
- Add keyboard/screen-reader labels, focus handling, visible focus, touch targets, contrast, reduced-motion support, and semantic status announcements.
- Add deliberate loading, empty, offline, permission-denied, upload-failed, expired, and retry states.
- Reduce unnecessary Realtime subscriptions, repeated signed-URL creation, duplicate requests, and unbounded message fetches where safe.
- Run full Vitest suite, full ESLint, TypeScript/build validation, and migration/security checks.
- Review the final aggregate diff for RLS regressions, leaked secrets, unbounded data exposure, accidental unrelated edits, and unsupported claims.
- Record any checks that cannot run. Do not mark the feature complete based on a prior CI run alone.

## Delivery constraints

- Keep all work on `feature/messages-phase1-polish` and in PR #51.
- Do not merge or deploy until all implementation and verification are complete.
- Do not add paid services, billing changes, or payment flows.
- No secrets, service-role keys, or provider credentials belong in client code or commits.
