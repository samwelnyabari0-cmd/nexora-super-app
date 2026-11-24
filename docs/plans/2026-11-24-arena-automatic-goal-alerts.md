# Nexora Arena Automatic Goal Alerts Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver automatically loaded football fixtures, deduplicated goal-only alerts, and opt-in Android Web Push notifications that can arrive while Nexora is closed.

**Architecture:** Keep SportScore for its existing visible live scoreboard and attribution, but move background monitoring to a centrally scheduled server process. First prove a server-side provider path and its quota; then persist score snapshots and idempotent goal events, and use the existing Nexora push foundation with authenticated user-owned subscriptions and service-worker display handling.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Vite/Nitro on Vercel, Supabase Postgres, Vitest, `web-push`, Bun.

## Global Constraints

- Fixtures load automatically across the competitions supported by the selected provider; users do not need to search for teams or matches.
- Provider requests are made centrally and cached/shared; request volume must not multiply with Nexora's user count.
- Removing user search does not remove the provider's daily quota. Polling cadence must fit a verified quota and must not silently exceed it.
- Keep the current SportScore browser integration for visible live scores unless an implementation task proves a safe replacement. Preserve its visible, crawlable “Powered by SportScore” attribution wherever SportScore data is displayed.
- The Supabase Edge Function's SportScore request previously received HTTP 403. Do not schedule that path unless a fresh server-side test proves access.
- Existing provider setup documentation records SportScore's published approximate 10,000 requests per 24 hours per IP and 60-second edge caching, and API-Football Free's 100 requests/day. Recheck provider terms, quotas, supported competitions, and server reachability before production activation.
- Initial score seeding must not create goal alerts. Only a subsequent increase in either team's score creates a goal event. Score decreases/corrections, minute changes, halftime, full-time, and unchanged scores do not create alerts.
- A provider retry or repeated poll must not duplicate a goal event or push.
- Goal alerts are opt-in; request browser notification permission only after a user action. Users can disable alerts and remove their subscription.
- Keep VAPID private credentials and all provider secrets server-side. Never trust a client-supplied user ID or arbitrary endpoint as authorization.
- Push delivery while closed is conditional on a supported Android browser/PWA context, a valid service-worker registration, notification permission, and configured server credentials.
- Preserve the existing offline caching, media-range handling, and outbox sync behavior in `public/sw.js`.
- Do not change existing favorite-team or club-sync features into requirements for global fixture loading or global goal alerts.

---

### Task 1: Prove the background provider and quota-safe polling path

**Files:**
- Modify: `docs/football-provider-setup.md`
- Create: `src/features/football/background-provider.ts` (proposed provider-neutral adapter)
- Create: `src/features/football/background-provider.test.ts`
- Create: `api/football/goal-monitor.ts` (proposed Vercel server endpoint; confirm this repository's Nitro/Vercel route convention before implementation)
- Modify: `vercel.json` (proposed; only if Vercel Cron is confirmed supported by the deployed project)

**Interfaces:**
- `fetchBackgroundFixtures(options: { from: string; to: string }): Promise<FootballMatch[]>` returns normalized fixtures with stable provider IDs.
- The scheduled monitor authenticates using a server-only cron secret and returns poll metadata (provider, fetched count, updated count, next eligible poll time) without exposing credentials.
- Provider selection remains behind the adapter so the client-facing `fetchSportScoreMatches()` contract does not change.

- [ ] **Step 1: Add focused failing tests**
  - Test normalization of a live fixture with stable provider ID, scores, competition, kickoff, and elapsed minute.
  - Test rejection of non-2xx provider responses, malformed payloads, and missing stable fixture IDs.
  - Test that a configured minimum polling interval prevents a second upstream request before the interval expires.
  - Test that provider quota/rate-limit responses are surfaced as a deferred poll, not converted into empty or zero-score fixtures.

- [ ] **Step 2: Verify the relevant failure**
  - Run: `bun run test -- src/features/football/background-provider.test.ts`
  - Expected: the test file or new adapter exports are missing before implementation.

- [ ] **Step 3: Implement the minimum provider boundary**
  - Inspect the actual Vercel/Nitro server route conventions and use the supported server entry point rather than assuming a standalone API directory is deployed.
  - Test the SportScore widget/fixture endpoint from the Vercel server runtime. The existing Supabase Edge Function HTTP 403 is not evidence that Vercel egress will work.
  - If SportScore is reachable, use its documented endpoint and attribution requirements; otherwise test the existing API-Football provider and its currently available plan quota. Do not activate an insufficient quota.
  - Store provider choice, minimum polling interval, and last successful poll in server-side configuration/state. Do not poll once per client or user.
  - Return cached Supabase fixtures to clients; no user-triggered search is needed to populate the global fixture list.
  - If no tested provider/plan can support the agreed monitoring interval, keep background monitoring disabled and report the exact provider/plan decision needed rather than pretending closed-app alerts are live.

- [ ] **Step 4: Verify the focused pass**
  - Run: `bun run test -- src/features/football/background-provider.test.ts`
  - Expected: normalization, timeout, malformed response, rate-limit, and interval tests pass.

- [ ] **Step 5: Run the affected integration check**
  - Run: `bun run lint -- src/features/football/background-provider.ts src/features/football/background-provider.test.ts`
  - Run: `bun run build`
  - Expected: lint and production build pass; provider smoke-test evidence and quota decision are recorded in `docs/football-provider-setup.md`.

- [ ] **Step 6: Commit the passing deliverable**
  - Stage only the provider adapter, its tests, server monitor entry point, any confirmed scheduler config, and provider documentation.
  - Commit message: `feat: add quota-aware background football provider`.

### Task 2: Make push subscriptions user-owned and add service-worker push display

**Files:**
- Modify: `src/lib/push.ts`
- Modify: `src/lib/push.functions.ts`
- Modify: `public/sw.js`
- Create: `src/lib/push.test.ts`
- Create: Supabase migration `supabase/migrations/<timestamp>_secure_user_push_subscriptions.sql` (exact timestamp generated when implemented)

**Interfaces:**
- `enablePushNotifications(): Promise<PushSubscription>` remains the browser opt-in entry point.
- Add `disablePushNotifications(): Promise<void>` to unsubscribe the browser and delete only the authenticated user's matching subscription.
- Server-side save/delete operations derive identity from a verified Supabase session; the client cannot supply or impersonate an owner ID.
- Service worker handles `push` and `notificationclick` events; push payload shape is `{ title: string; body: string; url?: string; tag?: string }`.

- [ ] **Step 1: Add focused failing tests**
  - Test that a subscription cannot be saved without an authenticated user.
  - Test that saving a subscription associates it with the authenticated user and upserts by endpoint/user identity.
  - Test that one user cannot delete another user's subscription.
  - Test that a push payload produces a notification with title/body and a safe same-origin navigation target.
  - Test that invalid or expired subscription delivery results are eligible for subscription cleanup.

- [ ] **Step 2: Verify the relevant failure**
  - Run: `bun run test -- src/lib/push.test.ts`
  - Expected: tests fail against the current global endpoint-only `push_subscriptions` persistence and absent service-worker push handlers.

- [ ] **Step 3: Implement secure subscription ownership and push events**
  - Add a `user_id` ownership column and authenticated RLS policies to the push-subscription persistence model. Preserve valid existing rows only if they can be safely associated with an authenticated owner; otherwise leave them inactive for re-subscription rather than guessing ownership.
  - Review current `createServerFn` authentication conventions before changing server handlers. Remove any client-callable arbitrary-endpoint push-sending capability; only trusted server-side goal-event delivery may send notifications.
  - Keep the public VAPID key in client configuration and private key/subject only in server environment.
  - Request notification permission only from the explicit Arena/settings enable action.
  - Extend `public/sw.js` without changing existing cache/fetch/sync behavior. Parse the push payload defensively, show a notification, and on click open or focus a same-origin Nexora Match Center URL.
  - Disable flow unsubscribes PushManager and deletes the current user's database row; it must be safe to retry.

- [ ] **Step 4: Verify the focused pass**
  - Run: `bun run test -- src/lib/push.test.ts`
  - Expected: ownership, opt-in/opt-out, payload parsing, and notification navigation tests pass.

- [ ] **Step 5: Run the affected integration check**
  - Run: `bun run lint -- src/lib/push.ts src/lib/push.functions.ts src/lib/push.test.ts`
  - Run: `bun run build`
  - Expected: lint and production build pass; existing offline service-worker tests/behavior remain unchanged.

- [ ] **Step 6: Commit the passing deliverable**
  - Stage only the push client/server functions, service worker, migration, and tests.
  - Commit message: `feat: secure Nexora web push subscriptions`.

### Task 3: Persist score snapshots and deduplicated goal events

**Files:**
- Create: `src/features/football/goal-events.ts`
- Create: `src/features/football/goal-events.test.ts`
- Create: Supabase migration `supabase/migrations/<timestamp>_football_goal_events.sql`
- Modify: `api/football/goal-monitor.ts` (or the verified server monitor path from Task 1)

**Interfaces:**
- `detectGoalEvents(previous: ScoreSnapshot | null, current: FootballMatch): GoalEvent[]` returns events only for score increases after a baseline exists.
- `ScoreSnapshot` includes provider, provider fixture ID, home score, away score, status, and observed timestamp.
- `GoalEvent` includes stable event ID/idempotency key, fixture identity, scoring side, resulting score, competition, minute, and creation timestamp.
- Server monitor persists the new snapshot and inserts goal events with a database uniqueness constraint before dispatch.

- [ ] **Step 1: Add focused failing tests**
  - First observation with a 0–0 or already-scored match creates no event.
  - A home score increase creates exactly one home goal event.
  - An away score increase creates exactly one away goal event.
  - A 1–0 to 2–1 update can represent both newly observed score increases without duplicate event IDs.
  - Unchanged score, minute-only change, LIVE-to-HT, HT-to-LIVE, LIVE-to-FT, and score decrease create no event.
  - A retry with the same fixture and resulting score produces the same idempotency key.
  - Missing scores or a fixture identity change do not generate a guessed goal.

- [ ] **Step 2: Verify the relevant failure**
  - Run: `bun run test -- src/features/football/goal-events.test.ts`
  - Expected: tests fail before the goal detector and event contract are implemented.

- [ ] **Step 3: Implement score baseline and idempotent event persistence**
  - Add a score-snapshot table keyed by provider and provider fixture ID, and a goal-event table with a unique idempotency key based on provider, fixture, and resulting home/away score.
  - Lock or atomically upsert each fixture snapshot so concurrent scheduled invocations cannot both emit the same goal event.
  - Seed missing snapshots without generating notifications.
  - Compare subsequent scores independently for home and away increases; ignore score corrections/decreases for notification purposes while updating the current snapshot.
  - Insert event rows before delivery. A repeated poll that hits the unique key must not send another notification.
  - Do not infer a minute or scorer when the provider does not supply it.

- [ ] **Step 4: Verify the focused pass**
  - Run: `bun run test -- src/features/football/goal-events.test.ts`
  - Expected: all baseline, score-increase, non-goal status, correction, and idempotency tests pass.

- [ ] **Step 5: Run the affected integration check**
  - Run: `bun run lint -- src/features/football/goal-events.ts src/features/football/goal-events.test.ts`
  - Run: `bun run build`
  - Expected: lint/build pass and the monitor persists one event for each newly detected score increase.

- [ ] **Step 6: Commit the passing deliverable**
  - Stage only the detector, migration, monitor integration, and tests.
  - Commit message: `feat: detect and persist deduplicated football goals`.

### Task 4: Deliver goal alerts in Nexora Arena and activate safe background delivery

**Files:**
- Modify: `src/features/football/useMatchCenter.ts`
- Modify: `src/routes/match-center.tsx`
- Modify: `src/lib/push.functions.ts`
- Modify: verified server monitor path from Task 1
- Create: `src/features/football/goal-notifications.test.ts`
- Modify: `docs/football-provider-setup.md`

**Interfaces:**
- Arena notification preference is user-scoped and defaults to disabled until the user opts in.
- Server goal-event dispatcher loads only opted-in users' active subscriptions and sends the same event payload to each.
- Delivery failures for expired/invalid subscriptions remove only the invalid subscription; transient failures remain retryable.
- Active clients receive the same persisted goal events for in-app toast/banner presentation; browser score refresh itself remains silent.

- [ ] **Step 1: Add focused failing tests**
  - Test that a newly persisted goal event is dispatched once to enabled users.
  - Test that disabled users receive no push.
  - Test that a duplicate event is not dispatched again.
  - Test that a transient push failure remains retryable and an invalid/expired endpoint is deactivated.
  - Test that in-app alerts appear for new goal events only, not minute/status refreshes.
  - Test that the Arena enable/disable control does not request permission until clicked and removes the subscription when disabled.

- [ ] **Step 2: Verify the relevant failure**
  - Run: `bun run test -- src/features/football/goal-notifications.test.ts`
  - Expected: tests fail before the preference, dispatcher, and in-app event subscription are added.

- [ ] **Step 3: Implement delivery, preference, and UI**
  - Add a user-scoped goal-alert preference with default disabled. Enabling first requests browser permission, then saves the push subscription and preference; if any step fails, show a specific error and do not show the preference as enabled.
  - Disabling sets the preference off and unsubscribes/removes the current device subscription without affecting other devices.
  - Fan out only newly persisted goal events to enabled subscriptions. Use an event-delivery record or equivalent idempotency boundary so retries cannot duplicate successful sends.
  - Keep delivery server-side; never call the sender from a user-controlled endpoint with arbitrary title/body/endpoint values.
  - Add an Arena control explaining that alerts are goal-only and may depend on provider coverage and Android notification permission.
  - Deliver persisted goal events to active sessions for an in-app alert. Do not create in-app alerts from routine 60-second refreshes.
  - Deep-link notification clicks to the relevant match in Nexora Arena, falling back to `/match-center` when no match route exists.

- [ ] **Step 4: Verify the focused pass**
  - Run: `bun run test -- src/features/football/goal-notifications.test.ts`
  - Expected: fan-out, opt-in/out, retry, duplicate suppression, and in-app alert tests pass.

- [ ] **Step 5: Run the affected integration check**
  - Run: `bun run test`
  - Run: `bun run lint`
  - Run: `bun run build`
  - Expected: full Vitest suite, ESLint, and production build pass. Verify on a real Android device with the PWA installed: enable alerts, receive a test goal push while foregrounded, backgrounded, and fully closed; tap the notification and confirm Match Center opens.

- [ ] **Step 6: Commit the passing deliverable**
  - Stage only the Arena hook/route, goal-notification dispatcher, tests, and provider documentation.
  - Commit message: `feat: deliver goal-only Arena notifications`.

## Unresolved product and operational decisions

- **Provider and plan:** the exact server-accessible provider and plan cannot be selected until a real Vercel server-runtime request verifies access, competition coverage, commercial-use terms, and quota. Recommendation: test SportScore from Vercel first; if blocked, compare a provider plan that supports the desired poll volume before asking the user to approve any paid spend.
- **Polling interval:** recommendation is 60 seconds during active live fixtures only if the selected provider quota and platform scheduler support it; otherwise choose a slower interval based on verified limits and disclose the expected alert delay.
- **Competition scope:** proposed default is all competitions the selected provider actually returns and permits; unsupported competitions must not be represented as covered.
- **Android delivery target:** the repository already has a standalone PWA manifest and service worker. Verify installation and push support on the user's Android browser/device before claiming closed-app delivery is operational. If Nexora is used only inside a native wrapper, the push integration needs that wrapper's native provider.
- **Existing unowned push subscriptions:** current persistence stores subscriptions by endpoint without a user owner. Existing rows cannot safely be attributed to users; they should be treated as stale and users should re-subscribe after the ownership migration.
