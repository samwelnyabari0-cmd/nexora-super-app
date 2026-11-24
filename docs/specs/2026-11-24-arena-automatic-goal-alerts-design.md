# Nexora Arena Automatic Goal Alerts — Design

**Status:** Proposed design for review  
**Date:** 2026-11-24

## Goal

Provide automatic football fixtures and score updates in Nexora Arena, with goal-only alerts delivered in-app and as Android push notifications when Nexora is in the background or closed.

## User experience

- Fixtures load automatically across the competitions supported by the selected data provider. Users do not need to search for teams or matches.
- Match scores and statuses refresh centrally and are shared through Nexora's backend/cache.
- A score increase is treated as a candidate goal event. Routine clock/minute changes, kickoff, halftime, full-time, and unchanged scores do not create goal notifications.
- When Nexora is open, a goal can appear as an in-app alert.
- When Nexora is closed, an opted-in user can receive a phone push notification containing the teams, updated score, and match minute when available.
- Users can turn goal notifications off. The browser/Android notification permission is requested only after the user explicitly enables notifications.
- Optional team favourites may remain as a preference, but they are not required for fixture loading or global goal coverage.

## Architecture

1. **Visible live scoreboard:** retain the existing SportScore browser integration for Match Center display and preserve its required visible attribution.
2. **Background goal detector:** use a server-accessible football feed, called centrally by a scheduled backend job. The provider must be tested from the actual server runtime before it is selected for production. The existing SportScore server-side request returned HTTP 403, so that path must not be assumed to work.
3. **Quota-aware central polling:** one scheduled poll per provider endpoint/window, not one request per Nexora user. Cache normalized fixtures/scores in Supabase and reuse the cached data across users. Configure polling cadence to fit the verified provider quota and live-match coverage.
4. **Goal event detection:** persist the last observed score per stable fixture identity. Seed an initial baseline without sending alerts. Thereafter create a goal event only when a home or away score increases. Ignore score decreases/corrections for alerting, and make event creation idempotent so retries do not send duplicate alerts.
5. **Push delivery:** store each user's Web Push subscription in Supabase with ownership enforced by RLS. Keep VAPID/private credentials server-side. A backend sender delivers the event to users who have enabled goal alerts and have valid subscriptions. Notification taps should open the relevant Match Center view.
6. **In-app delivery:** publish or retrieve the same deduplicated goal event for active sessions so the in-app alert and phone push share one event source.

## Quota and reliability

- Removing user search removes user-triggered search calls; it does not remove the football provider's own daily quota.
- Poll centrally and cache results so request volume does not multiply with the number of users.
- Before production activation, verify provider access from the scheduled server environment, supported competition coverage, update latency, rate limits, attribution requirements, and failure behavior.
- If the verified free quota cannot support the desired polling interval, reduce polling frequency or select a suitable plan/provider rather than silently exceeding limits.
- Show cached fixtures when the provider is temporarily unavailable; do not fabricate live scores.
- Log poll outcomes and quota/rate-limit failures for operational visibility.

## Android/PWA considerations

- Confirm the deployed Nexora app is installable as a PWA and has a correctly scoped service worker before promising closed-app push behavior.
- Android push requires a supported browser/PWA context and explicit notification permission. If Nexora is distributed through a native wrapper rather than a browser-installed PWA, use that wrapper's supported push mechanism instead.
- Test notification delivery with the app foregrounded, backgrounded, and fully closed on a real Android device.

## Security and data model (proposed)

- A push-subscriptions table associates an authenticated user with endpoint, encryption keys, and timestamps. Users may create, refresh, and delete only their own subscriptions.
- A goal-events table stores provider/fixture identity, resulting score, event timestamp, and a unique idempotency key.
- Provider credentials, VAPID keys, and service-role credentials remain server-side; never expose them to browser code.
- Scheduled jobs and event-sending functions authenticate internally and are safe to retry.

## Acceptance criteria

1. Fixtures appear automatically without a user searching.
2. Multiple users share centrally fetched/cached fixture data; provider requests do not scale per user.
3. A newly observed score increase produces one goal event, not repeated events on subsequent polls.
4. Initial score seeding, minute changes, halftime, full-time, unchanged scores, and score corrections do not produce goal alerts.
5. Users who enable notifications and grant permission receive Android push when the app is closed, subject to supported PWA/browser behavior.
6. Users can disable alerts and remove/refresh their push subscription.
7. Provider quota, polling cadence, attribution, and server reachability are verified before production enablement.
8. Provider outages do not create fabricated scores or duplicate alerts.

## Open implementation checks

- Test candidate provider endpoints from the scheduled server runtime and record actual quota/coverage.
- Inspect the current manifest and service-worker setup; determine whether Nexora is an installable PWA on Android.
- Confirm whether goal alerts should be enabled by default after explicit OS permission, or require a separate in-app opt-in. Proposed default: off until the user explicitly enables them.
