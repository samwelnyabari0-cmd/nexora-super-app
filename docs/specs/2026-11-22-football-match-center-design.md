# Football Match Center Design

## Goal

Add a low-data, live-first football hub to Nexora with cached live scores, fixtures, short football announcements, on-demand highlights, favorite teams, and explicit sharing into selected Nexora club channels, without replacing the existing LIVE streaming experience.

## Current repository context

- `src/routes/live.tsx` is the existing creator/live-streaming experience and must remain intact.
- The new experience will use a dedicated `/match-center` route and a separate football feature module.
- Clubs currently use `src/features/clubs/useClubData.ts` and a database-backed channel messaging flow; football sharing should integrate through the existing channel write boundary rather than creating a second messaging system.
- The app uses Supabase for persistent data and Vercel for deployment. Provider credentials must remain server-side.

## Approved product behavior

- Live-first architecture: design for genuine live scores from a provider that contractually supports live match data and the desired update cadence.
- No paid provider subscription or usage charges are authorized by this design. Provider choice, pricing, quotas, licensing, and any paid activation require separate user approval.
- Dedicated Match Center with league pills: All, Live, EPL, UCL, La Liga, and FKF Premier League where supported by the selected provider.
- Compact score rows display status such as LIVE minute, HT, FT, or kickoff time. Keep rows visually compact and readable on mobile.
- Breaking/transfer announcements show source, timestamp, short headline, and a two-line summary.
- Highlights display a lightweight thumbnail, score badge, and duration. Do not fetch or embed the video player until the user taps; prefer official or licensed destinations.
- Users can follow favorite football teams (distinct from Nexora social clubs).
- Users may explicitly opt a followed team into one or more Nexora clubs. Never auto-post to all clubs.
- “Discuss in Club” is a user-initiated action that posts a compact match card into a selected accessible club channel.
- Lite mode suppresses thumbnails and nonessential images, keeps text-first score/news cards, and never autoplays video.
- Home/Explore may show small cached previews linking to Match Center; do not duplicate the full module or load large media in the feed.

## Recommended architecture

1. Define a provider-neutral server adapter for fixtures, live scores, competitions, teams, announcements, and highlight links. Provider-specific response shapes must not leak into the client or database contract.
2. Store normalized snapshots in Supabase tables for matches, announcements, and highlights. Add user favorite-team records and per-team/per-Nexora-club sync preferences. Use stable provider IDs plus provider keys to avoid duplicate fixtures.
3. Allow public clients to read published cached data only. All ingestion writes occur through a server-side Vercel function or Supabase Edge Function using a server secret; never expose the provider key in browser bundles.
4. Schedule ingestion around match windows. Target 60–120-second refreshes for active matches only when the chosen provider quota, Vercel/Supabase scheduler limits, and plan support the cadence. Outside match windows, reduce polling. If the upstream source is unavailable, keep the last successful snapshot and display its update time/stale state.
5. Build the `/match-center` route and isolated components/hooks for league filtering, score rows, news, highlights, favorite teams, and Lite mode. Keep the existing `/live` route untouched.
6. Add a server-authorized “Discuss in Club” action that verifies the user is a member with permission to post in the chosen channel, then inserts a structured match-card payload or safe text/link representation using the existing club message model.
7. Add small cached Home/Explore preview cards only after identifying the existing feed insertion point; avoid coupling the feed to the external football API.

## Data and security boundaries

- Proposed tables: `football_matches`, `football_announcements`, `football_highlights`, `football_favorite_teams`, and `football_club_team_sync`.
- Public SELECT policies expose only published football cache rows and safe fields. User favorites are private to their owner. Club-team sync preferences are readable/writable only by authorized club members/administrators and the owning user according to the chosen interaction contract.
- Only trusted server functions can insert/update football cache rows.
- Store provider source IDs, source URLs, `updated_at`, and a freshness marker. Keep timestamps timezone-aware.
- Validate channel membership and message permissions at write time; sharing a score must never bypass club privacy.
- Highlight destinations must be source-attributed and must not imply Nexora hosts or owns third-party video.

## Failure and stale-data behavior

- If a provider times out or rate-limits, retain the last good cache, record the failed sync, and retry with bounded backoff.
- If no live provider is configured, show an honest setup/unavailable state rather than fabricated scores.
- If a competition or team is not covered by the provider, omit it or label coverage clearly; do not synthesize results.
- If a user loses access to a club between opening the share UI and posting, reject the post and show a permission message.
- If an announcement/highlight source is unavailable or unlicensed, omit it rather than scraping or mirroring it.

## Verification

- Unit-test provider normalization, match status formatting, deduplication, freshness/stale behavior, and polling-window selection.
- Test that public clients cannot write football cache rows and cannot read another user's favorites.
- Test favorite-team and club-sync authorization, including private clubs.
- Test match-card sharing against real club membership/role boundaries.
- Add route/component tests for league filters, Lite mode, no-data state, and deferred highlight loading.
- Run focused tests, full test suite, touched-file lint, production build, and Supabase security advisors before requesting release.

## Out of scope

- Replacing Nexora LIVE streaming, hosting third-party highlight videos, betting/odds, fantasy football, paid club memberships, or activating a paid football API subscription.
