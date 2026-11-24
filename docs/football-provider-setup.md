# Nexora Football Provider Setup

Nexora Arena reads football matches from the Supabase `football_matches` cache. Browser clients never call the sports provider directly. The free SportScore adapter is `supabase/functions/sportscore-sync/index.ts`; the existing API-Football adapter remains available as a fallback and is not required by SportScore.

## Free live scores with SportScore

- API base: `https://sportscore.com`
- Fixture endpoint: `GET /api/v1/fixtures/?sport=football&date=YYYY-MM-DD&limit=200`
- No API key is required for the SportScore free data tier.
- The sync discovers fixtures for today and the next seven UTC dates, refreshing each date no more often than every six hours.
- During a cached match window (three hours before through two hours after kickoff), the function refreshes the relevant calendar date once per scheduled invocation. The one-minute schedule therefore uses no live-score request when no cached match is in its match window.
- SportScore documents approximately 10,000 requests per 24 hours per IP and 60-second edge caching. A busy day can use about 1,440 live refresh requests plus fixture discovery. Monitor actual quota and throttling; this is a best-effort free service with no SLA.
- Cached rows use provider `sportscore`, so they coexist with existing `api-football` rows under the existing unique key `provider,provider_id`.
- Existing club score auto-posting is preserved and deduplicated by score/status signature.

## Attribution and usage terms

Every Nexora page/screen that displays SportScore data must show a visible, crawlable dofollow link to [SportScore](https://sportscore.com/) with anchor text that mentions SportScore. Match Center includes a visible “Powered by SportScore” link. Do not remove it unless SportScore gives Nexora written permission for an attribution-free commercial arrangement.

SportScore's published terms allow caching normalized responses in Nexora infrastructure and using the data in an early-stage commercial product while the required attribution is displayed. Data is provided as-is; accuracy, coverage, uptime and continued free access are not guaranteed. Keep the last successful cache when an upstream request fails. Do not redistribute bulk raw datasets or present the API as a competing sports-data feed.

## Deploy and authenticate the Edge Function

Apply the migration `20261124201500_sportscore_sync_auth_and_cron.sql` before scheduling the function. It enables `pg_cron` and `pg_net` and creates a service-role-only RPC that validates the scheduled caller's token against Supabase Vault.

Deploy the function:

```bash
supabase functions deploy sportscore-sync
```

No custom Edge Function secret is required. The function uses the Supabase runtime's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values internally. Create three Vault entries in the SQL Editor (replace the project URL and publishable key with the values from this Supabase project):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<SUPABASE_PUBLISHABLE_KEY>', 'publishable_key');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sportscore_sync_secret');
```

The sync token is generated inside Postgres and stays in Vault. The Edge Function validates it through `verify_sportscore_sync_secret`; it is never stored in Git or exposed to the browser.

## Schedule through Supabase Cron

Create or replace the one-minute job:

```sql
select cron.schedule(
  'nexora-sportscore-live-sync',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sportscore-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sportscore_sync_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

The function checks the Supabase cache before making a live request. Outside the match window it skips the live upstream request. Monitor `cron.job_run_details` and `net._http_response` for scheduler/API errors.

## Existing API-Football fallback

The original `football-sync` function and `API_FOOTBALL_KEY` setup are unchanged. API-Football's free tier is limited to 100 requests/day, so it should not be scheduled every minute. Do not schedule both providers every minute unless you deliberately want both feeds and have reviewed their quotas.

## News and highlights

`football_announcements` and `football_highlights` remain source-attributed cache tables. Populate them only from feeds/links that permit redistribution or embedding; prefer official club/league/broadcaster destinations. Highlights open the external destination only when tapped. No third-party video is mirrored or autoplayed.

## Official references

- [SportScore developer portal](https://sportscore.com/developers/) — free tier, endpoints, attribution and published request guidance.
- [SportScore API reference](https://sportscore.com/developers/api/) — fixture response schema and endpoint parameters.
- [SportScore terms](https://sportscore.com/developers/terms/) — caching, attribution, commercial use and limitations.
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — `pg_cron`, `pg_net`, and Vault-backed secrets.
