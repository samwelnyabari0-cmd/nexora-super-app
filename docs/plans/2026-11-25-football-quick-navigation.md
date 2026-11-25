# Football Quick Navigation Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing long Football view on `/match-center` into a Matchday Pulse plus six-icon dashboard with grouped in-page sections and a Back to Football action.

**Architecture:** Keep the implementation inside the existing TanStack route and reuse its current hooks and feature components. Add a local typed section state with a dashboard state, render one grouped section at a time, and keep the existing top-level Football / Instant play / Cups mode state independent.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, lucide-react, Tailwind CSS, Vitest, Testing Library, Bun.

## Global Constraints

- Keep Matchday Pulse near the top of the Football view.
- Immediately below Matchday Pulse, show exactly six decorated navigation tiles: Live Scores, Golden Boot, News, Highlights, Fixtures, and Fan Zone.
- Each tile opens its grouped content in the same Football route.
- Every opened section includes a left-arrow “Back to Football” control returning to the six-tile dashboard, not Nexora home.
- Use a responsive three-column mobile layout that adapts on wider screens; prevent overlap and preserve readable labels.
- Keep Football / Instant play / Cups separate; only Football receives this dashboard.
- Preserve existing football hooks, data, refresh, goal alerts, Lite mode, permissions, external links, and feature behavior.
- Do not change database schema, Edge Functions, provider integrations, or Gaming/Cups behavior.

---

### Task 1: Add six-section dashboard navigation and typed section state

**Files:**
- Modify: `src/routes/match-center.tsx`
- Test: `src/routes/match-center.test.tsx` (proposed; follow the repository's Vitest and Testing Library setup)

**Interfaces:**
- Consumes existing `MatchCenterPage`, `useMatchCenter()`, `useMatchdayForm(data.matches)`, `useClubData("")`, and current `activeMode` state.
- Produces a local section state with values `"home" | "scores" | "golden-boot" | "news" | "highlights" | "fixtures" | "fan-zone"`; six navigation descriptors with stable IDs, labels, and Lucide icon components; and a dashboard view directly after Matchday Pulse.

- [ ] **Step 1: Add focused failing tests**

Test the route's football navigation:
1. Initial Football view renders Matchday Pulse followed by exactly six navigation controls with the exact labels Live Scores, Golden Boot, News, Highlights, Fixtures, and Fan Zone.
2. Clicking each navigation control changes to its matching section view.
3. Each section view renders a visible “Back to Football” button.
4. Clicking “Back to Football” returns to the six navigation controls.
5. Switching to Instant play or Cups continues to show the existing mode content rather than the football dashboard.

Mock the existing data hooks and feature components at their module boundaries so the tests assert navigation and grouping without depending on remote Supabase data.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/routes/match-center.test.tsx`

Expected: the focused test fails because the current Football view renders every section in one continuous page and has no six-item navigation state.

- [ ] **Step 3: Implement the dashboard**

In `src/routes/match-center.tsx`:
1. Add a typed `activeFootballSection` state initialized to `"home"`; keep it separate from `activeMode`.
2. Add six navigation descriptors using distinct lucide-react icons and the exact approved labels.
3. Keep Matchday Pulse in the Football branch before the conditional dashboard/section content.
4. Render the six descriptors in a responsive grid: three columns on mobile, with a wider layout at desktop breakpoints. Each tile is a semantic button with an accessible name and `aria-pressed` reflecting its selected state where appropriate.
5. On tile activation, set the matching section ID. Do not change route, query parameters, or football data hooks.
6. Render a clear heading and a left-arrow “Back to Football” button for each selected section. The button sets `activeFootballSection` to `"home"`.
7. Keep the existing status controls and Matchday Pulse above the dashboard; preserve the existing Football / Instant play / Cups selector outside the Football-only content.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/routes/match-center.test.tsx`

Expected: all six navigation and back-navigation tests pass, including mode-switch isolation.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run lint -- src/routes/match-center.tsx src/routes/match-center.test.tsx`

Expected: ESLint reports no errors in the touched route and test file.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/match-center.tsx src/routes/match-center.test.tsx
git commit -m "feat: add football quick navigation dashboard"
```

### Task 2: Group existing football features under the six destinations

**Files:**
- Modify: `src/routes/match-center.tsx`
- Test: `src/routes/match-center.test.tsx`

**Interfaces:**
- Consumes the section state and six navigation descriptors from Task 1, plus existing data values and feature components.
- Produces six mutually exclusive section panels using the existing feature components and handlers; no new data API or route is introduced.

- [ ] **Step 1: Add focused grouping assertions**

Extend the route tests to assert:
1. Live Scores contains the Match ticker, competition filters, and existing match rows/empty state.
2. Golden Boot contains `GoldenBootLeaderboard`.
3. News contains Breaking & transfer news and its existing empty state.
4. Highlights contains Quick highlights and preserves Lite mode thumbnail suppression.
5. Fixtures contains `ArenaFixturesTables`.
6. Fan Zone contains `MatchdayFanPolls`, squad discussion, favorite teams, the fan poll, and audio watch-along.
7. A section does not render unrelated section panels at the same time.
8. Returning to the dashboard and reopening a section does not clear the existing filter, favorite-team, squad selection, Lite mode, or alert state.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/routes/match-center.test.tsx`

Expected: grouping assertions fail until the existing panels are moved into their corresponding section branches.

- [ ] **Step 3: Move existing content into its approved group**

Keep the current component instances, event handlers, data expressions, and permission checks:
- `"scores"`: Match ticker, competition filters, loading/error/empty states, `MatchRow`, and match-sharing actions.
- `"golden-boot"`: `GoldenBootLeaderboard`.
- `"news"`: Breaking & transfer news panel.
- `"highlights"`: Quick highlights panel; keep `liteMode` controlling thumbnail rendering and keep links opening only on explicit click.
- `"fixtures"`: `ArenaFixturesTables`.
- `"fan-zone"`: `MatchdayFanPolls`, squad discussion, favorite-team add/remove and club-sync forms, `ArenaFanPoll`, and audio watch-along.
Keep the source-attribution footer and Squads / Nexora LIVE links in the Football dashboard or selected section in a single consistent location; do not duplicate them. Keep existing `data`, `clubs`, `matches`, and handler state at the page component level so navigation does not remount the data hooks.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/routes/match-center.test.tsx`

Expected: all section grouping, empty-state, Lite mode, and state-retention assertions pass.

- [ ] **Step 5: Run full verification**

Run: `bun run test`

Expected: the complete Vitest suite passes.

Run: `bun run lint -- src/routes/match-center.tsx src/routes/match-center.test.tsx`

Expected: no lint errors in the touched files.

Run: `bun run build`

Expected: Vite/TanStack production build completes successfully.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/routes/match-center.tsx src/routes/match-center.test.tsx
git commit -m "feat: group football features into navigation sections"
```

## Unresolved product decisions

- None. The six labels, grouping, dashboard-first entry state, in-page navigation, and return behavior are defined by the approved specification.
