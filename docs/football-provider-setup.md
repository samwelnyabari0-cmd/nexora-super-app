# Nexora Football Provider Setup

Nexora Arena reads football matches from the Supabase `football_matches` cache. Browser clients never call the sports provider directly. The free SportScore adapter is `supabase/functions/sportscore-sync/index.ts`; the existing API-Football adapter remains available as a fallback and is not required by SportScore.

## Free live scores with SportScore

- API base: `https://sportscore.com`
- Fixture endpoint: `GET /api/v1/fixtures/?sport=football&date=YYYY-MM-DD&limit=200`
- No API key is required for the free tier.
- The sync discovers fixtures for today and the next seven UTC dates, refreshing each date no more often than every six hours.
- During a cached match window (three hours before through two hours after kickoff), the function refreshes the relevant calendar date once per scheduled invocation. Schedule at one-minute intervals only when you want live updates; the function makes no live-score request when no cached match is in its match window.
- The provider documents approximately 10,000 requests per 24 hours per IP and 60-second edge caching. With the one-minute schedule, a busy day can use about 1,440 live refresh requests plus fixture discovery. Monitor actual quota and throttling; this is a best-effort free service with no SLA.
- Cached rows use provider `sportscore`, so they coexist with existing `api-football` rows under the existing unique key `provider,provider_id`.
- Existing club score auto-posting is preserved and deduplicated by score/status signature.

## Required attribution and usage terms

Every Nexora page/screen that displays SportScore data must show a visible, crawlable dofollow link to [SportScore](https://sportscore.com/) with anchor text that mentions SportScore. The Match Center includes a visible “Powered by SportScore” link. Do not remove it unless SportScore gives Nexora written permission for an attribution-free commercial arrangement.

SportScore's published terms allow caching normalized responses in Nexora infrastructure and using the data in an early-stage commercial product while the required attribution is displayed. Data is provided as-is; accuracy, coverage, uptime and continued free access are not guaranteed. Keep the last successful cache when an upstream request fails. Do not redistribute bulk raw datasets or present the API as a competing sports-data feed.

## Deploy the Edge Function

```bash
supabase functions deploy sportscore-sync
```

Set the function secrets (the Supabase runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`):

```bash
supabase secrets set FOOTBALL_SYNC_SECRET=<long-random-secret>
```

The function accepts only POST requests with the exact header `Authorization: Bearer <FOOTBALL_SYNC_SECRET>`. No SportScore API key is needed. Keep all secrets server-side.

## Schedule through Supabase Cron

Enable `pg_cron`, `pg_net`, and Vault in the Supabase project. Store the project URL, a Supabase secret API key accepted by the Edge Function gateway (not a publishable key), and the same `FOOTBALL_SYNC_SECRET` in Vault. Then schedule:

```sql
select cron.schedule(
  'nexora-sportscore-live-sync',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sportscore-sync',
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

The one-minute job checks the Supabase cache first. Outside the match window it skips the live upstream request. Supabase Cron job history is available in the Dashboard.

## Existing API-Football fallback

The original `football-sync` function and `API_FOOTBALL_KEY` setup are unchanged. API-Football's free tier is limited to 100 requests/day, so it should not be scheduled every minute. Do not schedule both providers every minute unless you deliberately want both feeds and have reviewed their quotas.

## News and highlights

`football_announcements` and `football_highlights` remain source-attributed cache tables. Populate them only from feeds/links that permit redistribution or embedding; prefer official club/league/broadcaster destinations. Highlights open the external destination only when tapped. No third-party video is mirrored or autoplayed.

## Official references

- [SportScore developer portal](https://sportscore.com/developers/) — free tier, endpoints, attribution and published request guidance.
- [SportScore API reference](https://sportscore.com/developers/api/) — fixture response schema and endpoint parameters.
- [SportScore terms](https://sportscore.com/developers/terms/) — caching, attribution, commercial use and limitations.
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — `pg_cron`, `pg_net`, and Vault-backed secrets.