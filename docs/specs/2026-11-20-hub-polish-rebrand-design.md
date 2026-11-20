# Nexora Hub Polish & Rebrand Design

**Status:** Approved design direction; awaiting user review of this written specification.

## Goal

Give the Nexora Hub's seven existing mini-apps distinct branded identities and a consistent, polished dark-mode interface, while preserving existing functionality, saved data, and module identifiers.

## Existing repository context

- Hub entry point: `src/routes/hub.tsx`.
- Module identity and labels: `src/features/hub/logic.ts` via `ModuleId` and `allModules`.
- Device cache, Ghost State, and signed-in cloud sync: `src/features/hub/useHub.ts`.
- Shared UI primitives: `src/components/nexora/ui.tsx`.
- Hub pure-function tests: `src/features/hub/logic.test.ts`.
- Existing module IDs are `tasks`, `notes`, `budget`, `deals`, `tools`, `focus`, and `workflow`. These IDs are persisted in local storage and cloud state and must not change.
- The current `HubPage` displays a generic grid of panels and the Mini-App Store uses `allModules`. The Value Ledger currently summarizes completed tasks, focus minutes, and monthly subscriptions.
- `useHub` already exposes cloud status and uses local storage plus signed-in Supabase sync. The current page subtitle says device-only, which can misrepresent signed-in cloud sync.

## Product decisions

### Module branding

Keep the persisted IDs and map them to these display names and identities:

| Existing ID | Display name | Icon concept | Accent |
|---|---|---|---|
| `budget` | PesaVault | Shield with coin pulse | Emerald and gold |
| `tools` | ShareTab | Split receipt | Cyan |
| `focus` | DeepPulse | Concentric timer rings | Violet |
| `workflow` | TaskForge | Spark / branching nodes | Indigo |
| `notes` and `tasks` | MindGrid | Notebook grid with pin | Slate blue |
| `deals` | TrustSpot | Verified map pin | Amber |
| Existing Ghost State control | ShadowBox | Ghost outline | Neon lavender |

MindGrid covers both existing Notes and Tasks surfaces. To avoid losing or migrating either dataset, keep the two existing module IDs and their independent hide/reorder preferences; give both surfaces the MindGrid identity with clear Notes and Tasks subtitles. ShadowBox labels the existing Ghost State banner and controls, which remain a separate sandbox capability rather than being incorrectly attached to the task checklist.

### Visual system

- Preserve Nexora's dark signature surfaces and violet/cyan brand accents.
- Use seven restrained module accents only for icons, small highlights, and progress details; do not recolor entire cards.
- Standardize card radius, padding, borders, headings, form-control heights, and touch targets.
- Replace loud uppercase status tags with subtle icon-led pills. Each status must describe the actual state (for example: device saved, cloud synced, manual entries, sample listings). Add accessible explanatory text or native title hints.
- Use reduced-motion-aware transitions and avoid animation that blocks interaction.

### Value Ledger and visual feedback

- Keep existing task-completion, focus-minute, and subscription totals.
- Add a monthly budget allowance setting only if the existing data model can be extended backward-compatibly. No allowance is assumed or prefilled with an invented amount.
- When a user enters an allowance, show recurring monthly subscriptions against it and the remaining amount. If the allowance is unset or zero, show subscription totals without implying a remaining balance.
- Add an accessible horizontal breakdown bar with textual values; color is not the only carrier of meaning.
- DeepPulse receives an SVG/CSS circular progress indicator derived from the existing 25-minute countdown. Timer start, pause, reset, and completion accounting remain unchanged.
- Task completion gets restrained, reduced-motion-aware visual feedback. Task data and completion behavior remain unchanged.

### Data and privacy

- Do not rename or migrate persisted module IDs.
- Do not add payment processing, bank connections, M-Pesa transactions, or external financial integrations.
- Preserve Ghost State isolation: edits made in Ghost State must remain temporary until committed and be discarded without modifying saved state.
- Display local/cloud status based on the actual `useHub` status. Do not claim cloud sync for signed-out users or claim device-only storage when signed-in sync is active.
- Preserve current sample-listing and manual-entry disclosures.

## Scope boundaries

Included: Hub branding, module cards and Mini-App Store labels, Ghost State/ShadowBox naming, shared Hub card and form polish, status pills, Value Ledger visualization, DeepPulse timer ring, task completion feedback, accessibility and mobile fit. Notes and Tasks remain separately stored and independently reorderable/hidden, but both display the MindGrid identity.

Not included: CivicPulse, TrustSpot community ratings, bill calendar, export/import, encrypted backup, theme preferences, new payment flows, or changing the underlying module capabilities.

## Proposed implementation files

- Modify `src/features/hub/logic.ts` for display metadata while retaining `ModuleId` values.
- Modify `src/routes/hub.tsx` for branded Hub layout, ShadowBox/Ghost State presentation, accurate sync status, Value Ledger, timer ring, and task feedback.
- Modify `src/components/nexora/ui.tsx` only where shared card/status primitives are needed.
- Modify `src/features/hub/useHub.ts` only if a backward-compatible optional monthly allowance is approved and required.
- Extend `src/features/hub/logic.test.ts` and add focused component tests using the repository's existing Vitest and Testing Library setup.

## Verification and acceptance

- Existing Hub tests remain green.
- Tests prove all existing module IDs remain unchanged and branded labels map to the correct functions.
- Legacy local and cloud Hub payloads without an allowance continue to sanitize correctly.
- Ghost State enter/commit/discard behavior remains unchanged.
- Timer progress is correct at full, half, paused, and completed states.
- Allowance breakdown is not shown as meaningful when no allowance is set.
- Status pills reflect actual local/cloud/sample/manual states.
- Run focused Vitest tests, targeted ESLint, full `npm test`, and `npm run build`; run TypeScript check if the repository's existing CI supports it.
- No production deployment occurs until checks pass and the user approves the finished changes.

## Unresolved implementation detail

The user should confirm that Notes and Tasks should retain separate cards and separate visibility/order controls while sharing the MindGrid brand identity. ShadowBox is the existing Ghost State banner/control and remains separate from the task checklist.
