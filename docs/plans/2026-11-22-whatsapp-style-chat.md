# WhatsApp-Style Mobile Chat Experience Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a focused, readable WhatsApp-style mobile experience for Nexora direct and group conversations without removing existing messaging capabilities.

**Architecture:** Keep inbox navigation in the existing `AppShell`, but derive an active-conversation mode from the messages route search parameters. Reuse the existing direct/group message components and lock/expiry logic, moving settings into a shared conversation-details surface and consolidating composer actions into a reusable attachment tray. Preserve Supabase message and settings contracts; this is primarily a client UI/layout change.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS, shadcn/ui/Radix, lucide-react, Vitest, Testing Library, Vite, Bun.

## Global Constraints

- Hide the global Nexora header and mobile bottom navigation only while an active direct or group conversation is open; retain them on the inbox and other screens.
- Keep a compact sticky conversation header with back action, avatar/name, presence where available, and supported call/video actions.
- Open conversation details/settings by tapping the contact/group identity. Chat lock and disappearing-message controls belong there, not in permanent rows above the message history.
- Display a subtle system status line only when its state is derived from actual lock/expiry settings.
- Give the message lane 12–16 px horizontal gutters, 10–12 px bubble padding, and a maximum bubble width of approximately 80% (78–82% acceptable).
- Keep photos, videos, voice notes, and document cards contained within message bubbles.
- Replace the permanently visible multi-button toolbar with one plus/paperclip control opening a labelled 2-column by 3-row tray: Gallery, Document, Location, Go Live, 1h Ephemeral, AI Assist.
- The composer grows from one line to six lines; remove the separate Expand control. Preserve the existing message send behavior and maximum message length.
- Include approximately 16 px bottom safe-area spacing and keep the composer usable with the Android keyboard open.
- Preserve existing messaging permissions, Supabase policies, message schema, uploads, location sharing, voice messages, reactions, and lock/expiry behavior.
- Stage 2 features (PDF page-count extraction/preview/summarization, contextual AI chips, group filters and role/thread changes) are out of scope.

---

### Task 1: Focused active-chat shell and viewport layout

**Files:**
- Modify: `src/components/nexora/AppShell.tsx`
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Test: proposed `src/components/nexora/__tests__/AppShell.chat-mode.test.tsx`
- Test: proposed `src/routes/__tests__/messages-layout.test.tsx`

**Interfaces:**
- Consumes: TanStack Router `useRouterState` pathname/search; existing `Route.useSearch()` in `/messages`; existing `GroupChat` `groupId`, `userId`, `onBack` props.
- Produces: an active-chat predicate in AppShell based on `pathname === "/messages"` and a non-empty `recipient` or `group` search parameter; direct/group chat roots sized to the available viewport.

- [ ] **Step 1: Add focused failing tests**

Test AppShell with route states for `/messages` without search, `/messages?recipient=user-id`, `/messages?group=group-id`, and a non-messages route. Assert global header/mobile navigation remain on inbox and non-chat routes, and are hidden only for direct/group conversation routes. Add layout assertions that direct and group chat roots use a flex column with a flexible message log and fixed composer region.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/components/nexora/__tests__/AppShell.chat-mode.test.tsx src/routes/__tests__/messages-layout.test.tsx`

Expected: tests fail because AppShell currently always renders the global top bar and mobile navigation, and the active conversation uses a constrained height that does not account for the shell header/navigation.

- [ ] **Step 3: Implement the minimum behavior**

In `AppShell.tsx`, read router search state and derive active direct/group chat mode from the current messages URL. In this mode omit the global top header and mobile bottom navigation and remove the shell's content top/bottom padding; keep desktop navigation behavior deliberate and ensure no content is hidden behind it. In `messages.tsx` and `GroupChat.tsx`, use a mobile viewport-height flex layout with `min-h-0`, `min-w-0`, and independent message-log scrolling. Account for the compact chat header and composer within the viewport rather than applying the previous fixed 75dvh/12rem subtraction. Preserve inbox return behavior and the existing `onBack` flow.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/components/nexora/__tests__/AppShell.chat-mode.test.tsx src/routes/__tests__/messages-layout.test.tsx`

Expected: all route-mode and layout tests pass, including no active-chat mode for the inbox list.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run lint`

Expected: ESLint completes without new errors in AppShell, direct chat, or group chat.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/components/nexora/AppShell.tsx src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora/__tests__/AppShell.chat-mode.test.tsx src/routes/__tests__/messages-layout.test.tsx
git commit -m "feat: focus mobile shell on active conversations"
```

### Task 2: Sticky conversation header and details/settings drawer

**Files:**
- Create: proposed `src/components/nexora/ConversationDetailsSheet.tsx`
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Reuse: `src/components/nexora/ChatLockPanel.tsx`
- Reuse: `src/components/nexora/DisappearingSettingsControl.tsx`
- Test: proposed `src/components/nexora/__tests__/ConversationDetailsSheet.test.tsx`

**Interfaces:**
- Consumes: `ChatLockPanel` prop `lock: ChatLockState`; `DisappearingSettingsControl` props `chatKind: "direct" | "group"` and `chatId: string`; direct recipient profile/presence state; group info/member state.
- Produces: `ConversationDetailsSheet` props `open: boolean`, `onOpenChange(open: boolean): void`, `chatKind: "direct" | "group"`, `chatId: string`, `lock: ChatLockState`; conversation header identity trigger.

- [ ] **Step 1: Add focused failing tests**

Test that opening the sheet exposes the existing lock and expiry controls for both direct and group chats, closing it restores the conversation, and the trigger is keyboard accessible. Test the header continues to show the correct direct recipient/group identity and does not display another user's presence as the current user's presence.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/components/nexora/__tests__/ConversationDetailsSheet.test.tsx`

Expected: tests fail because there is no shared conversation details sheet and settings are rendered as permanent rows in both chat implementations.

- [ ] **Step 3: Implement the minimum behavior**

Create a Radix/shadcn sheet or dialog wrapper that composes the existing lock and expiry controls without changing their Supabase RPC contracts. Make the contact/group identity in each sticky header the accessible trigger. Remove the permanent `ChatLockPanel` and `DisappearingSettingsControl` rows from the message stream. Keep the existing locked-chat full-screen unlock flow intact; the settings sheet is for an unlocked conversation. Render a compact lock/expiry system line only from actual lock configuration and the currently loaded expiry value; if the lock/expiry state cannot be established, do not invent a status.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/components/nexora/__tests__/ConversationDetailsSheet.test.tsx`

Expected: sheet open/close, keyboard activation, direct/group setting composition, and status-line state tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run lint`

Expected: no unused imports or type errors from moving settings into the shared sheet.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/components/nexora/ConversationDetailsSheet.tsx src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora/__tests__/ConversationDetailsSheet.test.tsx
git commit -m "feat: move chat settings into conversation details"
```

### Task 3: Compact attachment tray and auto-growing composer

**Files:**
- Create: proposed `src/components/nexora/ChatAttachmentTray.tsx`
- Create: proposed `src/components/nexora/ChatComposer.tsx`
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Reuse: existing file input/upload, location-sharing hook, live-sharing actions, share-content dialog, voice recording, and AI smart-reply handlers in each chat implementation.
- Test: proposed `src/components/nexora/__tests__/ChatAttachmentTray.test.tsx`
- Test: proposed `src/components/nexora/__tests__/ChatComposer.test.tsx`

**Interfaces:**
- Produces: `ChatAttachmentTray` props `open: boolean`, `onOpenChange(open: boolean): void`, `actions: { gallery: () => void; document: () => void; location: () => void; goLive: () => void; ephemeral: () => void; aiAssist: () => void }`.
- Produces: `ChatComposer` props `value: string`, `onValueChange(value: string): void`, `onSubmit(): void`, `disabled: boolean`, `placeholder: string`, `leadingAction`, optional `trailingAction`, and optional attachment/recording state slots. Keep upload and message persistence in the existing direct/group owners.

- [ ] **Step 1: Add focused failing tests**

Test tray rendering as a labelled 2-column by 3-row set of Gallery, Document, Location, Go Live, 1h Ephemeral, and AI Assist actions. Assert each action invokes only its supplied callback and closes the tray as designed. Test composer one-line initial state, auto-growth through six visible lines, internal scrolling beyond six lines, Enter/send behavior consistent with current chat behavior, disabled submission, and accessible labels.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/components/nexora/__tests__/ChatAttachmentTray.test.tsx src/components/nexora/__tests__/ChatComposer.test.tsx`

Expected: tests fail because the current direct and group composers expose seven always-visible icon buttons and a separate Expand control with input/textarea mode toggling.

- [ ] **Step 3: Implement the minimum behavior**

Build the tray using the existing dialog/sheet primitives and text labels. Wire Gallery and Document to the existing file selection flow (use an appropriate file-input accept filter while preserving all currently supported formats); Location to the existing one-time location share; Go Live to the existing live-location/share flow; 1h Ephemeral to the existing one-hour live/ephemeral action as supported by the current code; AI Assist to the existing smart-reply flow. Do not create new persistence behavior. Use one controlled auto-resizing textarea with a one-to-six-line visual cap and internal overflow after the cap. Keep send as the submit action, preserve the 2,000-character maximum and current voice recording capability, and place any retained quick action in the input row without restoring the full toolbar. Add bottom padding using `calc(16px + env(safe-area-inset-bottom))`. Reuse the same shared composer/tray in direct and group chat to avoid behavioral drift.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/components/nexora/__tests__/ChatAttachmentTray.test.tsx src/components/nexora/__tests__/ChatComposer.test.tsx`

Expected: all six tray callbacks, sheet accessibility, textarea growth cap, submission, and disabled-state tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run lint`

Expected: direct/group handlers are wired once, no removed toolbar state is left unused, and there are no TypeScript/ESLint errors.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/components/nexora/ChatAttachmentTray.tsx src/components/nexora/ChatComposer.tsx src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora/__tests__/ChatAttachmentTray.test.tsx src/components/nexora/__tests__/ChatComposer.test.tsx
git commit -m "feat: simplify chat attachments and composer"
```

### Task 4: Message bubble sizing, safe-area and mobile regression verification

**Files:**
- Modify: `src/routes/messages.tsx`
- Modify: `src/components/nexora/GroupChat.tsx`
- Modify: existing attachment styles only if required after inspection of `MessageAttachment`
- Test: proposed `src/components/nexora/__tests__/ChatBubbleLayout.test.tsx`
- Test: proposed `src/components/nexora/__tests__/ChatViewport.integration.test.tsx`

**Interfaces:**
- Consumes: direct/group message row rendering, existing `MessageAttachment`, `VoiceNotePlayer`, `LocationShareCard`, `SharedContentCard`.
- Produces: consistent responsive bubble layout shared by direct and group conversations; no change to message data or event handlers.

- [ ] **Step 1: Add focused failing tests**

Test incoming and outgoing text bubbles at a 320 px viewport and a 360 px viewport: outer gutters remain at least 12 px, internal padding is 10–12 px, width does not exceed 82% of the message lane, and no horizontal overflow occurs. Test long unbroken text, long sender names, PDF/file cards, images, video, voice notes, location cards, and reactions. Test the composer remains above the bottom safe area when keyboard viewport height shrinks.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/components/nexora/__tests__/ChatBubbleLayout.test.tsx src/components/nexora/__tests__/ChatViewport.integration.test.tsx`

Expected: at least one sizing/overflow assertion fails against the existing unconstrained message wrapper or attachment dimensions.

- [ ] **Step 3: Implement the minimum behavior**

Apply consistent outer horizontal message gutters and bubble padding in both chat renderers. Constrain bubble width to the 78–82% target and use `min-w-0`, `max-w-full`, and safe word wrapping for long text and embedded cards. Ensure image/video/document previews cannot widen the bubble. Retain current timestamps, delivery/read indicators, reactions, reply actions, and sender labels. Confirm the composer safe-area style is applied once and that keyboard resizing does not create a second scroll container or hide the latest message.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/components/nexora/__tests__/ChatBubbleLayout.test.tsx src/components/nexora/__tests__/ChatViewport.integration.test.tsx`

Expected: all 320 px/360 px overflow, bubble sizing, attachment containment, and keyboard/safe-area tests pass.

- [ ] **Step 5: Run repository integration checks**

Run: `bun run test`
Expected: all Vitest tests pass.

Run: `bun run lint`
Expected: ESLint completes without errors.

Run: `bun run build`
Expected: Vite/TanStack production build exits successfully.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/messages.tsx src/components/nexora/GroupChat.tsx src/components/nexora/__tests__/ChatBubbleLayout.test.tsx src/components/nexora/__tests__/ChatViewport.integration.test.tsx
git commit -m "fix: improve mobile chat bubble and viewport layout"
```

## Unresolved product decisions

- **Call/video controls:** direct/group headers currently expose only the actions already supported by each chat implementation. This plan retains supported actions and does not add a new calling backend.
- **AI Assist tray behavior:** reuse the current smart-reply suggestion flow; no new AI generation mode or automatic sending is introduced.
- **Ephemeral action semantics:** preserve the existing one-hour action's actual behavior; do not silently reinterpret live-location sharing as message expiry. If the existing UI's “1h” button is confirmed to be location sharing only, label it accurately in the tray and expose message expiry only in conversation details.
- **Desktop presentation:** the approved spec emphasizes Android/mobile. Keep desktop shell navigation usable and apply the focused active-chat treatment responsively without hiding the desktop rail unless a separate product decision is made.
