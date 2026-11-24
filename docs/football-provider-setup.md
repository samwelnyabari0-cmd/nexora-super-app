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

## News and highlights

`football_announcements` and `football_highlights` remain source-attributed cache tables. Populate them only from feeds/links that permit redistribution or embedding; prefer official club/league/broadcaster destinations. Highlights open the external destination only when tapped. No third-party video is mirrored or autoplayed.

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
