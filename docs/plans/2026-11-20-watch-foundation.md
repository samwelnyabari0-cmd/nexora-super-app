# Nexora Watch Foundation — Implementation Plan

Date: 2026-11-20
Branch: feature/watch-foundation
Design: docs/specs/2026-11-20-watch-foundation-design.md

## Rules
- Keep work isolated on this branch.
- No production migration application, merge, or deployment without separate explicit approval.
- No Cloudflare, R2, Paystack, upload, or paid vendor dependencies.
- Keep sample titles visibly labelled as demo content.
- Use test-first implementation and GitHub Actions verification.

## Step 1 — Inspect existing contracts
Re-fetch the complete Watch route, route registration, shared UI primitives, generated Supabase types, and relevant migration conventions. Confirm TanStack Router search-param APIs and whether an existing player/dialog primitive can be reused. Do not edit implementation files until these contracts are known.

## Step 2 — Database migration
Create watch_titles, watch_episodes, and watch_progress with checks, foreign keys, unique episode ordering, and valid progress bounds. Enable RLS on every table. Public catalogue reads must expose only visible records; browser clients get no catalogue write access. Progress SELECT/INSERT/UPDATE must be owner-only, with no anonymous access. Add explicit grants compatible with the project's Data API configuration. Keep the migration unapplied in production.

## Step 3 — Typed data layer
Add Watch types and query helpers. Map pending, processing, ready, and unavailable states explicitly. Add category filtering, robust error/empty handling, and clearly labelled demo fallback. Test category matching, status mapping, fallback labelling, progress percentage, and invalid progress bounds.

## Step 4 — Supabase-backed screen
Use the database as the primary catalogue source. Implement All, Documentary, Series, and Food filters with URL query synchronization. Add 16:9 skeletons, empty/error/retry states, and accurate progress for signed-in users. Preserve the existing hero visual hierarchy.

## Step 5 — HLS player
Check the lockfile for hls.js before adding a dependency. Use native HLS when supported and hls.js otherwise. Offer Auto/manual quality only when actual levels are available. Handle unsupported browsers, missing manifests, network errors, and media cleanup. Never open the manifest in a new tab or treat arbitrary MP4 as HLS.

## Step 6 — Progress synchronization
Resume signed-in users from saved progress. Save a throttled heartbeat about every 12 seconds and save on pause, seek, and ended. Prevent overlapping/stale writes. Anonymous progress remains local/in-memory. Playback continues if sync fails, with a non-blocking warning.

## Step 7 — Series episodes
Load episode metadata, show season/episode selection, and play only ready episode manifests. Defer automatic next episode until manual verification.

## Step 8 — Verification
Run targeted tests, lint, production build, and TypeScript audit in GitHub Actions. Review migration and PR diff. Manual Android Chrome playback verification requires a real HLS asset; until then report it as unverified. Keep PR draft until checks pass and the user reviews it. No production migration, merge, or deployment without explicit approval.
