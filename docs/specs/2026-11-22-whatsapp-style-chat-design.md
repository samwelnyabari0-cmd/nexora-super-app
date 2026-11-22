# WhatsApp-Style Mobile Chat Experience — Design Specification

**Date:** 2026-11-22  
**Status:** Draft for user review  
**Scope:** Stage 1 — mobile conversation experience for direct and group chats

## 1. Goal

Make Nexora conversations feel spacious, readable, and thumb-friendly on Android-sized screens while retaining Nexora's existing messaging capabilities. The conversation—not global navigation, settings controls, or attachment shortcuts—must receive the majority of the available viewport.

This stage is a focused layout and interaction redesign. It does not add new messaging backend capabilities or implement the advanced creator-messaging features listed in Stage 2.

## 2. User experience

### 2.1 Active conversation layout

When a direct or group conversation is open:

- Hide the global Nexora header and the bottom app navigation.
- Keep a compact, sticky conversation header with a back action, contact/group avatar and name, presence/last-seen detail where available, and existing call/video actions where supported.
- Tapping the contact/group identity opens the conversation details/settings surface. Chat lock and disappearing-message controls live there rather than occupying permanent rows above the message history.
- Show a single subtle system-status line in the conversation context when applicable, such as “🔒 Chat locked · Expiry off”. It must reflect actual settings and must not replace the controls for changing them.
- Keep the message history as the dominant flexible-height region. It scrolls independently; the header and composer remain available.
- Keep the inbox and global navigation visible on non-conversation screens.

### 2.2 Message bubbles and attachments

- Give the message lane 12–16 px horizontal screen gutters on narrow devices.
- Use 10–12 px internal bubble padding.
- Cap ordinary incoming and outgoing bubbles at approximately 80% of the available message lane width (acceptable design range: 78–82%).
- Distinguish incoming and outgoing messages clearly, and ensure neither edge is clipped by the viewport or parent container.
- Keep media previews compact and contained within their message bubble. Photos, videos, voice notes, and document cards must remain readable and must not force the conversation wider than the message lane.
- Preserve existing message timestamps, delivery/read states, reactions, date dividers, and attachment actions.

### 2.3 Composer and attachment tray

Replace the permanently visible multi-button toolbar with one attachment control:

- A plus/paperclip button sits at the left side of the composer.
- Activating it opens a labelled 2-column by 3-row attachment sheet containing: Gallery, Document, Location, Go Live, 1h Ephemeral, and AI Assist.
- The composer contains an auto-growing text area, expanding from one line up to six lines before scrolling internally.
- Keep at most one contextual quick action (Camera/Media or AI Assist) inside the input area, followed by Send. Do not retain a separate Expand button.
- Preserve existing upload, location sharing, live, ephemeral, and AI-assist behaviors; the redesign changes their entry points, not their permissions or underlying data behavior.
- Add bottom safe-area spacing equivalent to 16 px, including Android gesture/navigation inset handling, so the composer is not flush against the system navigation area.

## 3. Layout and component boundaries

Apply the experience consistently to both direct and group conversations.

Likely implementation areas (confirm exact component ownership during implementation):

- `src/routes/messages.tsx`: direct-chat screen and inbox/conversation conditional layout.
- `src/components/nexora/GroupChat.tsx`: group conversation layout.
- `src/components/nexora/ChatLockPanel.tsx`: existing lock setup/unlock controls, surfaced through conversation details.
- `src/components/nexora/DisappearingSettingsControl.tsx`: existing expiry control, surfaced through conversation details.
- Existing attachment, voice-note, location, and shared-content components should be reused where possible.

Prefer small focused components for the conversation header/details surface, attachment tray, and composer if that keeps the direct and group implementations consistent. Avoid duplicating settings logic or changing database policies as part of this UI-only stage.

## 4. Interaction and state behavior

- Opening a conversation switches to the focused chat layout; returning to the inbox restores the normal app navigation.
- Header details/settings open and close without navigating away from the conversation.
- Attachment sheet actions invoke their existing flows and close the sheet when appropriate.
- Message submission continues to use the existing send path. Auto-resizing must not change message content or submission behavior.
- The message list retains independent scrolling and existing newest-message behavior.
- Chat lock and expiry indicators are derived from the actual conversation settings; do not display a hard-coded status.
- Preserve keyboard behavior: the composer remains visible when the Android keyboard opens, and the message list can still scroll to the latest message.

## 5. Accessibility and responsive behavior

- All icon-only controls need accessible names and usable touch targets (target at least 44 × 44 CSS px).
- Attachment sheet actions have visible text labels.
- Maintain sufficient contrast for message text, timestamps, status indicators, and selected controls in the existing theme.
- Avoid horizontal overflow, clipped file cards, overlapping controls, and fixed-height message areas.
- Support narrow Android screens and larger screens without making the chat lane excessively wide.

## 6. Out of scope for Stage 1

The following are explicitly deferred to Stage 2:

- PDF page-count extraction, inline PDF preview, and AI summarization.
- Contextual AI chips such as “Summarize PDF”, “Create Poll”, or “Create Event”.
- Group message filters/tabs for All, Files, Links, and Live.
- New group role/thread functionality or changes to messaging permissions and backend schema.

## 7. Acceptance criteria

1. In an active direct chat, the global Nexora header and bottom navigation are hidden; returning to the inbox restores them.
2. Group chats use the same focused layout behavior.
3. The sticky chat header remains visible and opens conversation details/settings when tapped.
4. Privacy/lock and expiry controls no longer occupy permanent full-width rows above the messages.
5. The message history uses the available space between header and composer and scrolls independently.
6. Incoming and outgoing bubbles have 12–16 px outer horizontal gutters, 10–12 px internal padding, and a maximum width within the 78–82% target range.
7. Images, videos, voice notes, and documents fit within their bubbles without clipping or horizontal overflow.
8. One attachment button opens a labelled 2×3 tray with all six requested actions.
9. The composer grows from one to six lines and has no separate Expand button.
10. The composer respects the bottom safe area and remains usable with the Android keyboard open.
11. Existing message sending, reactions, voice notes, uploads, location sharing, lock, expiry, and supported call/live actions continue to work.
12. No overlapping controls or unreadable message content on narrow mobile viewports.

## 8. Verification plan

- Run the repository's existing lint/typecheck/build commands.
- Test direct and group conversations at narrow Android viewport sizes.
- Test long incoming/outgoing text, multiple messages, photos, video, voice notes, and document cards.
- Test opening/closing conversation details and changing lock/expiry settings.
- Test every attachment tray action and message submission.
- Test keyboard-open and safe-area behavior.
- Confirm inbox navigation remains visible outside an active conversation.

## 9. Rollout

Implement Stage 1 in a focused change set. Verify the direct and group flows before production deployment. Stage 2 should receive a separate design/implementation cycle after Stage 1 has been reviewed on a real mobile screen.
