# Nexora Football Provider Setup

Nexora Arena combines the Supabase `football_matches` cache with SportScore's free live/recent feed. The Match Center calls SportScore directly from the user's browser only while the Match Center is visible; saved Supabase match rows remain the fallback.

## Free live scores with SportScore

- Public endpoint: `GET https://sportscore.com/api/widget/matches/?sport=football&limit=50`
- No API key is required. SportScore documents the widget API as CORS-enabled for browser use.
- The Match Center refreshes once per minute while visible and stops polling when the tab/app is hidden or the route is unmounted.
- SportScore documents approximately 10,000 requests per 24 hours per IP and 60-second edge caching. A continuously open Match Center uses about 1,440 requests/day per client IP. Monitor shared mobile-carrier NAT usage and throttling as the audience grows.
- This widget endpoint provides live and recent matches, not a full upcoming-fixture calendar. Upcoming fixtures can continue to come from another configured provider.
- SportScore results are merged with Supabase cache rows by home team, away team and kickoff date. Live data takes precedence for the same fixture; cached rows remain visible if the live request fails.

## Attribution and usage terms

Every Nexora page/screen that displays SportScore data must show a visible, crawlable dofollow link to [SportScore](https://sportscore.com/) with anchor text that mentions SportScore. Match Center includes a visible “Powered by SportScore” link. Do not remove it unless SportScore gives Nexora written permission for an attribution-free commercial arrangement.

SportScore's published terms allow caching normalized responses in Nexora infrastructure and using the data in an early-stage commercial product while the required attribution is displayed. Data is provided as-is; accuracy, coverage, uptime and continued free access are not guaranteed. Do not redistribute bulk raw datasets or present the API as a competing sports-data feed.

## Why the browser calls SportScore

The Supabase Edge Function was tested against both the documented fixture API and widget API. SportScore's Cloudflare edge returned HTTP 403 to the Supabase server egress, so the server-side polling job has been unscheduled. The browser-side widget call uses the documented CORS-enabled public endpoint and does not expose any private API key.

The `sportscore-sync` Edge Function and its Vault-backed authentication remain deployed but are not scheduled. Do not re-enable server-side polling unless SportScore confirms that the Supabase egress block has been lifted.

## Existing API-Football fallback

The original `football-sync` function and `API_FOOTBALL_KEY` setup are unchanged. API-Football's free tier is limited to 100 requests/day, so it should not be scheduled every minute.

## Fixtures, results and league tables with Football-Data.org

The Arena Fixtures / Results / Tables panel reads normalized cache rows from `football_matches` and `football_standings`. It does not call the provider from a user's browser.

- The server-side `football-data-sync` Edge Function fetches fixtures and results for six free-tier competitions: Premier League (`PL`), Champions League (`CL`), La Liga (`PD`), Bundesliga (`BL1`), Serie A (`SA`) and Ligue 1 (`FL1`).
- It fetches the current total/home/away standings for each competition and writes normalized rows to `football_standings`.
- Each sync uses one combined fixtures/results request plus six standings requests, staying below the provider's free-plan limit of 10 calls per minute when run once at a time.
- The browser reads the cache only. It refreshes the local view every five minutes; that does not trigger provider requests.
- Football-Data.org's free plan provides fixtures, schedules, league tables and delayed scores. It is not a real-time live-score source. Keep SportScore as the separate live ticker and goal-alert feed.
- FKF Premier League is not included in this provider's free competition coverage. The existing FKF/API-Football path remains separate.
- Nexora displays the required attribution: “Data provided by football-data.org”.

### Required server-side setup

Before deploying `football-data-sync`, configure these Edge Function secrets in the Supabase project:

- `FOOTBALL_DATA_API_TOKEN` — create a free account at [football-data.org](https://www.football-data.org/client/register) and copy the API token from its account area.
- `ARENA_FOOTBALL_SYNC_SECRET` — generate a long random secret used to authorize sync requests.
- `SUPABASE_SERVICE_ROLE_KEY` — use the existing project service-role secret; never place it in browser code or commit it.

Deploy the `football-data-sync` function after the secrets are present. Invoke it with a POST request and `Authorization: Bearer <ARENA_FOOTBALL_SYNC_SECRET>`. Configure a server-side schedule no more frequently than every six hours; keep the sync secret in Supabase Vault if the schedule is managed through `pg_cron`. Do not expose either provider token or sync secret to the client.

The database cache table and client UI can exist before a provider token is configured; the panel will show an empty-state message until the first successful sync.

## News and highlights

The `football-content-sync` Edge Function fills the existing source-attributed cache tables:

- **News:** Sky Sports' football RSS feed (`https://www.skysports.com/rss/11095`) is polled every 15 minutes. Nexora stores the headline, source name, publication time and canonical article link only; it does not copy article text or images. Each card links to the original publisher.
- **Official highlights:** the public YouTube feeds for the verified [Premier League channel](https://www.youtube.com/@premierleague) and [UEFA channel](https://www.youtube.com/@UEFA) are checked for videos whose titles identify highlights/goals. Nexora stores the official video link and YouTube thumbnail URL. The video itself is never embedded, mirrored or autoplayed; it opens only after a user taps the card.
- News and highlight cache rows older than 45 days are pruned only for feeds that completed successfully, so a temporary provider outage does not erase previously cached items.
- Only source-attributed headline/link previews are displayed. Obtain written commercial syndication permission before reproducing article excerpts, full text, or publisher imagery. Follow each publisher/platform's current terms.
- The sync uses the existing server-only `ARENA_FOOTBALL_SYNC_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`; neither is exposed in browser code. The cron job invokes the function every 15 minutes using the project's existing Vault-backed secret setup.

## Official references

- [SportScore developer portal](https://sportscore.com/developers/) — free tier, endpoints, attribution and published request guidance.
- [SportScore API reference](https://sportscore.com/developers/api/) — widget endpoint response schema and parameters.
- [SportScore terms](https://sportscore.com/developers/terms/) — caching, attribution, commercial use and limitations.


## Free automatic goal alerts

The first free implementation adds optional, in-app goal alerts in Nexora Arena:

- Alerts are off by default and can be switched on/off from the Arena toolbar. The preference is stored on the current browser/device.
- While Match Center is open, the existing 60-second SportScore browser refresh compares the latest live scores with the prior observed score.
- The first observed score for a fixture is only a baseline. Later score increases generate goal toasts; minute/status-only updates and score decreases do not.
- Repeated observations of the same score level are deduplicated for the current open session. A score correction followed by restoration of a previously observed score is not announced again.
- Alerts include the scoring team, resulting score, competition and minute only when the feed supplies a minute. Scorer identity is not inferred.
- This is best-effort coverage limited to fixtures SportScore returns. It is not a complete worldwide feed, and the browser stops checking when the page is closed or suspended.
- Android push notifications while Nexora is closed are not enabled by this implementation. The existing push subscription flow is not yet safe for goal-alert fan-out; it must first be made user-owned and server-authorized, and a server-reachable free provider must be proven.

This deliberately avoids creating per-user server polling or activating a paid provider. Do not describe this foreground-only feature as background monitoring or guaranteed worldwide coverage.
