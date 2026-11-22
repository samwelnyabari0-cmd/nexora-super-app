# Nexora Football Provider Setup

The Match Center is provider-neutral at the database/client boundary. The first server adapter uses API-Football v3. The browser reads only Supabase cache tables; provider credentials remain in Supabase Edge Function secrets.

## Provider behavior

- Live endpoint: `GET https://v3.football.api-sports.io/fixtures?ids=<cached-fixture-ids>&timezone=Africa/Nairobi`. The sync reads cached fixture IDs for EPL, UCL, La Liga, and FKF PL match windows (up to 20 IDs per request), then fetches their current statuses and scores.
- Fixture discovery: one rolling seven-day fixture request, refreshed at most once every six hours.
- The sync function checks the cached fixture window first and skips the upstream live request when no selected-competition kickoff is within three hours behind or two hours ahead.
- When a match window is active, the scheduled function can poll once per minute. API-Football documents fixture data refreshes at 15-second intervals and recommends one request per minute for competitions/fixtures with a match in progress. Actual coverage and latency vary by competition.
- The free API-Football tier currently lists 100 requests/day; the official documentation recommends one request/minute for competitions/fixtures with a match in progress. One two-hour match window can therefore exceed the free daily quota even with a single batched request per minute. The pricing page currently lists Pro at $19/month and 7,500 requests/day. Recheck pricing and competition coverage before activation; no paid plan is enabled by this repository change.

## Configure secrets after provider approval

Deploy the Edge Function:

```bash
supabase functions deploy football-sync
```

Set secrets in the Supabase project (never in browser/Vite environment variables):

```bash
supabase secrets set API_FOOTBALL_KEY=<provider-key> FOOTBALL_SYNC_SECRET=<long-random-secret>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the Supabase Edge Function runtime. The function requires an exact `Authorization: Bearer <FOOTBALL_SYNC_SECRET>` header and returns `503` while any required secret is missing.

## Schedule through Supabase Cron

Only schedule after the Edge Function is deployed and a provider plan with sufficient quota is approved. Enable `pg_cron`, `pg_net`, and Vault in the Supabase project. Store the project URL, a Supabase secret API key accepted by the Edge Function gateway (not a publishable key), and the same `FOOTBALL_SYNC_SECRET` in Vault. Then create the one-minute job using the Supabase SQL editor:

```sql
select cron.schedule(
  'nexora-football-live-sync',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/football-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_secret_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'football_sync_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

The function performs a cheap cache-window check on each invocation and only consumes an upstream live-score request during match windows. Supabase Cron job history is available in the Dashboard. The function retains the last good cache on provider failure.

## Auto-posting to Nexora clubs

A Creator/Admin follows a team and explicitly connects it to one of their clubs in Match Center. The sync function posts only when the score/status signature changes. It verifies the connection and the creator/admin membership in a database function; revoked/demoted connections are disabled. No match is broadcast to clubs without an enabled connection.

## News and highlights

`football_announcements` and `football_highlights` are source-attributed cache tables. Populate them only from feeds/links that permit redistribution or embedding; prefer official club/league/broadcaster destinations. Highlights open the external destination only when tapped. No third-party video is mirrored or autoplayed.


## Official references

- [API-Football v3 documentation](https://www.api-football.com/documentation-v3) — fixture status codes, update cadence, and maximum 20 fixture IDs per `ids` request.
- [API-Football pricing](https://www.api-football.com/pricing/) — current daily quotas and plan pricing.
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — `pg_cron`, `pg_net`, and Vault-backed secrets.
