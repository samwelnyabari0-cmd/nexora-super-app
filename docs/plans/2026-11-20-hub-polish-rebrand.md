# Nexora Hub Polish & Rebrand Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Nexora Hub with seven consistent branded identities, more polished status and card UI, clearer Value Ledger visuals, and an accessible DeepPulse progress ring without changing existing saved module IDs or behaviors.

**Architecture:** Keep the current Hub route and existing state model. Put display-only identity metadata in the pure Hub logic module, render the identity in the Hub route, and use existing shared UI primitives for consistent surfaces and status pills. Preserve the current `useHub` storage and Ghost State semantics; only add an optional monthly allowance field if the existing model can be extended without breaking older payloads.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS, lucide-react, Vitest, Testing Library.

## Global Constraints

- Preserve the persisted IDs `tasks`, `notes`, `budget`, `deals`, `tools`, `focus`, and `workflow`.
- Keep Notes and Tasks as separate cards with independent data, visibility, and order. Both carry the MindGrid identity with distinct Notes and Tasks subtitles.
- ShadowBox labels the existing Ghost State sandbox, not the Tasks checklist.
- PesaVault maps to budget, ShareTab to quick tools, DeepPulse to focus, TaskForge to workflow, MindGrid to notes and tasks, TrustSpot to deals.
- Preserve Ghost State commit/discard isolation and existing device/cloud persistence behavior.
- Do not add payments, bank connections, M-Pesa transaction integrations, community listings, or CivicPulse.
- Never invent a monthly budget allowance. If no allowance is explicitly entered, show only actual subscription spend.
- Respect reduced-motion preferences and ensure progress is communicated textually as well as visually.
- Do not merge or deploy without separate explicit user approval after verification.

---

### Task 1: Add stable mini-app identity metadata

**Files:**
- Modify: `src/features/hub/logic.ts`
- Test: `src/features/hub/logic.test.ts`

**Interfaces:**
- Consumes: existing `ModuleId` union and `allModules`.
- Produces: typed display metadata for the seven existing IDs, including display label, short descriptor, icon key, and restrained accent token. Keep IDs unchanged.

- [ ] **Step 1: Add focused failing tests**

Add assertions that the module metadata contains all seven existing IDs exactly once; maps budget=PesaVault, tools=ShareTab, focus=DeepPulse, workflow=TaskForge, notes=MindGrid, deals=TrustSpot, tasks=MindGrid; and does not change the existing `ModuleId` values.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: the test fails because the branded metadata export does not yet exist.

- [ ] **Step 3: Implement the minimum metadata**

Add one typed metadata object/list keyed by existing `ModuleId`; keep persisted IDs and any existing `allModules` compatibility required by the Hub and `useHub`. Use lucide icon component references only in the route layer, not in the pure logic module.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: all Hub logic tests pass and the identity mapping is exact.

- [ ] **Step 5: Run the affected integration check**

Run: `npx eslint src/features/hub/logic.ts src/features/hub/logic.test.ts`

Expected: no lint errors.

- [ ] **Step 6: Commit the passing deliverable**

Commit message: `feat(hub): define branded mini-app identities`.

### Task 2: Polish Hub cards, labels, and status communication

**Files:**
- Modify: `src/routes/hub.tsx`
- Modify: `src/components/nexora/ui.tsx`
- Test: `src/features/hub/logic.test.ts` and a focused Hub component test if an existing test harness supports rendering this route without broad app bootstrapping.

**Interfaces:**
- Consumes: identity metadata from Task 1; `useHub()` return values including `cloud`, `ghostOn`, and `online`.
- Produces: consistent branded module headings, subtle status pills, ShadowBox Ghost State presentation, and accurate sync-state copy.

- [ ] **Step 1: Add focused failing tests**

Test status-label selection for signed-out/device-only, cloud syncing, cloud synced, and cloud error states through a small pure helper. Test that Ghost State label is ShadowBox and that Notes/Tasks retain their separate module IDs and descriptive subtitles.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: new assertions fail because the display/status helper is absent.

- [ ] **Step 3: Implement the minimum UI**

Use consistent card spacing, restrained border/accent treatment, and compact icon-led status pills. Replace the misleading unconditional “saved on this device only” subtitle with accurate copy based on signed-in/cloud state. Keep sample/manual disclosures visible. Show MindGrid branding with Notes and Tasks subtitles. Label Ghost State banner and controls ShadowBox.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: all status and identity tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `npx eslint src/routes/hub.tsx src/components/nexora/ui.tsx src/features/hub/logic.ts src/features/hub/logic.test.ts`

Expected: no lint errors.

- [ ] **Step 6: Commit the passing deliverable**

Commit message: `feat(hub): polish branded cards and status pills`.

### Task 3: Improve Value Ledger and task completion feedback

**Files:**
- Modify: `src/routes/hub.tsx`
- Modify: `src/features/hub/logic.ts`
- Modify: `src/features/hub/useHub.ts` only if the optional allowance is implemented.
- Test: `src/features/hub/logic.test.ts`

**Interfaces:**
- Consumes: current task list and subscription data; `monthlyCost(amount, cycle)`.
- Produces: an accessible completion ratio and subscription-spend breakdown; optional allowance calculation only when the user has supplied a positive allowance.

- [ ] **Step 1: Add focused failing tests**

Test task completion percentage for zero tasks, partial completion, and all completed; test subscription spend breakdown from mixed weekly/monthly/yearly cycles; if allowance is added, test absent allowance yields no remaining balance and explicit allowance returns the correct remaining amount, including overspend.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: the new helper assertions fail because the calculations are not yet exposed.

- [ ] **Step 3: Implement the minimum visuals and calculation**

Add a labeled progress indicator for task completion and a clear monthly subscription breakdown. Do not add an allowance field unless it can be added compatibly: old cached/cloud records must continue to sanitize, and no default allowance may be inserted. Add restrained task-completion feedback with reduced-motion support and preserve checkbox semantics.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: calculations pass for empty, partial, full, and optional allowance edge cases.

- [ ] **Step 5: Run the affected integration check**

Run: `npx eslint src/routes/hub.tsx src/features/hub/logic.ts src/features/hub/useHub.ts src/features/hub/logic.test.ts`

Expected: no lint errors.

- [ ] **Step 6: Commit the passing deliverable**

Commit message: `feat(hub): add accessible value ledger breakdown`.

### Task 4: Add DeepPulse timer progress ring and final verification

**Files:**
- Modify: `src/routes/hub.tsx`
- Test: focused timer progress helper tests in `src/features/hub/logic.test.ts`

**Interfaces:**
- Consumes: current Focus component countdown state (1500 seconds total).
- Produces: accessible circular progress visual with textual time and percentage; timer start/pause/reset/completion accounting remains unchanged.

- [ ] **Step 1: Add focused failing tests**

Test progress at initial full duration, half duration, zero duration, and clamped values outside the expected range.

- [ ] **Step 2: Verify the relevant failure**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: progress helper tests fail because no timer progress calculation exists.

- [ ] **Step 3: Implement the minimum ring**

Use SVG stroke-dasharray/stroke-dashoffset or an equivalent CSS ring. Keep the time text as the primary live announcement; expose a descriptive accessible label and progress value. Respect `prefers-reduced-motion`. Do not change the timer interval or focus-minute logging.

- [ ] **Step 4: Verify the focused pass**

Run: `npx vitest run src/features/hub/logic.test.ts`

Expected: all timer progress tests pass.

- [ ] **Step 5: Run full verification**

Run: `npm test`, `npx eslint src/routes/hub.tsx src/components/nexora/ui.tsx src/features/hub/logic.ts src/features/hub/useHub.ts src/features/hub/logic.test.ts`, `npm run build`, and `npx tsc --noEmit`.

Expected: tests, targeted lint, and production build pass. Record any pre-existing TypeScript errors separately and do not hide or weaken tests to obtain a green result.

- [ ] **Step 6: Commit the passing deliverable**

Commit message: `feat(hub): add DeepPulse timer progress ring`.

## Unresolved product decisions

- Whether a monthly allowance input belongs in this first polish cycle. Recommendation: defer it to the later PesaVault utility feature; keep this cycle to actual subscription totals to avoid expanding the data model.
