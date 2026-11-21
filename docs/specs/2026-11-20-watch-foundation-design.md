# Nexora Watch Foundation — Design Specification

Date: 2026-11-20
Status: Draft for user review
Scope: Supabase-backed Watch catalogue, playback progress, and in-app HLS playback. This is a code-and-migration proposal only; it does not authorize production deployment or applying database migrations.

## Goals

- Replace the Watch screen's hardcoded catalogue as the primary data source with Supabase catalogue records.
- Preserve the existing sample titles as explicitly labelled demo content until real media assets are uploaded.
- Provide a secure, per-user watch-progress record that supports resume playback and accurate progress bars across devices.
- Play only verified ready streams inside Nexora, using native HLS where supported and hls.js where required.
- Make category filters functional, reflect them in the URL, and provide loading skeletons.
- Keep the implementation compatible with Nexora's current TanStack Router, Supabase client, session model, and mobile-first UI.

## Explicitly out of scope

- Video upload / creator studio, R2 buckets, presigned upload URLs, FFmpeg workers, transcoding webhooks, Cloudflare Stream, or any other paid media vendor.
- Paystack, subscriptions, premium gating, checkout, paid access, or payment processing.
- Live broadcasting, DRM, offline downloads, social watch parties, autoplay previews, and recommendation algorithms.
- Applying migrations to the production Supabase project, merging to main, or deploying to Vercel without separate user approval.

## Approaches considered

1. **Supabase catalogue + HLS-capable in-app player (recommended).** Store metadata and manifest references in Supabase; store each user's progress separately. Use native HLS when available and hls.js as the browser fallback. This gives Nexora a real data model without committing to a paid video host.
2. **Keep the static catalogue and add only a player.** Lowest initial change, but leaves the pending status, catalogue management, and cross-device progress unresolved.
3. **Adopt a managed video provider now.** Simplifies transcoding and delivery, but creates provider, storage, and potential billing commitments before the user has a budget or real video assets.

## Data model

### watch_titles
- UUID primary key; unique slug; title, description, category, content type, release year, duration, thumbnail and banner metadata.
- Optional HLS master manifest URL, nullable until a stream is ready.
- Status constrained to pending, processing, or ready.
- Featured flag and created/updated timestamps.
- No premium field or billing relationship in this phase.

### watch_episodes
- UUID primary key; parent title foreign key with cascade delete.
- Season and episode numbers, title, duration, optional thumbnail, nullable manifest URL, and a readiness state.
- Unique episode ordering within a title.
- Series episodes are playable only when their own stream is ready.

### watch_progress
- One row per authenticated user and title, with optional current episode, progress seconds, total seconds, and updated timestamp.
- Composite ownership key (user_id, title_id), with an integrity constraint ensuring any episode belongs to that title.
- Progress is private: SELECT/INSERT/UPDATE only for the owning authenticated user; no anonymous access and no cross-user reads.
- Progress values are clamped/validated in application logic and database constraints.

## Access and database security

- Enable RLS on all three public-schema tables.
- Catalogue metadata is readable by anonymous and authenticated visitors only for publicly visible catalogue entries. No write access from browser clients.
- Episode metadata is readable only when its parent title is publicly visible.
- Watch progress is accessible only to its owner; UPDATE policies include both USING and WITH CHECK ownership predicates.
- Explicitly grant only the table privileges required by the app's Data API access model. Supabase's 2026 Data API exposure change means creating a table does not itself guarantee it is exposed; verify project API exposure settings and grants rather than assuming.
- Do not expose service-role keys or create SECURITY DEFINER functions for this feature.
- Migration will be committed in the feature branch and reviewed before any production application.

## Frontend and playback behavior

- Fetch catalogue metadata from Supabase. Show a clearly marked demo fallback only when the catalogue is empty or unavailable; never represent a demo item as a real uploaded stream.
- Show status labels for pending/processing items. Remove the pending badge only for items whose actual stream has been verified and whose status is ready.
- Filter All, Documentary, Series, and Food categories; synchronize the selected category with the URL query parameter and support browser back/forward navigation.
- Use 16:9 skeleton cards while catalogue data is loading; show a useful retry/error state when loading fails.
- Open a Nexora in-app player for ready titles. Use native HLS if supported; otherwise use hls.js when supported. Do not silently treat a normal MP4 as HLS or open a stream in a new tab.
- Provide auto quality and manual quality choices only when the HLS engine exposes levels. Provide a clear unsupported/failed playback state and clean up media resources on close/unmount.
- Resume from the signed-in user's saved progress. Save a heartbeat approximately every 12 seconds while playing, plus on pause, seek, and ended; debounce writes and flush safely on lifecycle events. Anonymous users may watch public streams but progress remains local/in-memory only unless the user signs in.
- For series, load episode metadata and show episode selection. Automatic next-episode playback is deferred until the basic episode flow is verified.

## Error handling

- Distinguish catalogue loading failure, no catalogue entries, pending/processing media, missing manifest, unsupported HLS, and playback/network errors.
- Never mark an item ready solely because a URL is non-null; readiness is controlled by the ingestion process and must mean the manifest is playable.
- If progress saving fails, playback continues and the UI indicates that progress could not sync; do not discard the current session's position.

## Testing and verification

- Unit tests for catalogue status mapping, category filtering, progress percentage/clamping, and URL query behavior.
- Component tests for loading, empty, error, demo fallback, pending/processing, ready, and player states.
- Player tests for native-HLS selection, hls.js fallback, unsupported playback, quality selection, cleanup, resume, heartbeat throttling, and save-on-pause.
- Database migration review for foreign keys, constraints, grants, and RLS policies; verify anonymous catalogue reads and owner-only progress access using appropriate database test identities.
- Run targeted tests, lint, production build, and TypeScript checks in GitHub Actions.
- No claim of end-to-end streaming readiness until a real HLS manifest and its media segments are supplied and playback is manually verified on Android Chrome.

## Rollout

- Work on a separate feature branch and draft pull request.
- Keep the sample catalogue visible as demo content until actual titles are populated.
- Do not apply the database migration, merge, or deploy until the user reviews the completed PR and explicitly approves those actions.
