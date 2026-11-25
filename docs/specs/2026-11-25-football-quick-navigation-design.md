# Football Quick Navigation Design

## Goal

Reorganize the existing Football view on `/match-center` into a compact dashboard with six grouped navigation icons so users can reach major football features without scrolling through one long page.

## Approved behavior

- Keep Matchday Pulse near the top of the Football view.
- Immediately below Matchday Pulse, show exactly six decorated, clearly named navigation tiles:
  1. Live Scores
  2. Golden Boot
  3. News
  4. Highlights
  5. Fixtures
  6. Fan Zone
- Selecting a tile opens its grouped section in the same Football view; do not create separate routes.
- Every opened section has a left-arrow control labelled “Back to Football”. It returns to the six-icon dashboard, not the Nexora home page.
- Use a responsive layout (three columns on narrow/mobile screens, adapting for wider screens), with consistent spacing, readable labels, and no overlapping content.
- Keep the existing Football / Instant play / Cups mode switch. The six-item dashboard belongs only to Football.
- Preserve existing football data hooks, refresh behavior, goal alerts, Lite mode, club permissions, links, and feature behavior.

## Section mapping

- **Live Scores:** existing match ticker, competition filters, score rows, and match-sharing actions.
- **Golden Boot:** existing `GoldenBootLeaderboard`.
- **News:** existing Breaking & transfer news panel.
- **Highlights:** existing Quick highlights panel, retaining Lite mode thumbnail suppression and click-to-open behavior.
- **Fixtures:** existing `ArenaFixturesTables` (fixtures and tables).
- **Fan Zone:** existing `MatchdayFanPolls`, squad discussion, favorite teams and club sync controls, fan poll, and audio watch-along.

## Repository boundaries

- Modify only the existing `src/routes/match-center.tsx` for the navigation behavior unless implementation evidence requires a small focused test file.
- Do not change Supabase schema, Edge Functions, provider integrations, or other Arena modes.
- Keep all section content in the same route and retain the existing hooks and state.

## Verification

- Verify each of the six tiles opens only its mapped group.
- Verify Back to Football returns to the six-tile dashboard.
- Verify Matchday Pulse remains visible above the dashboard.
- Verify Football / Instant play / Cups switching still works and Gaming/Cups content is unchanged.
- Verify loading, empty, error, Lite mode, and existing user-action states remain intact.
- Run focused tests, lint for the touched file, and `bun run build`.
