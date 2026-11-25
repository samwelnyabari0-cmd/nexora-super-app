# Nexora World Daily News

Nexora's World and Kenya news panels use publisher RSS feeds and Google News RSS. They do not call a metered news API.

## Sources

| Vertical | Publisher | RSS URL | Stored provider |
|---|---|---|---|
| World | BBC World | https://feeds.bbci.co.uk/news/world/rss.xml | `world-bbc-rss` |
| World | Al Jazeera | https://www.aljazeera.com/xml/rss/all.xml | `world-aljazeera-rss` |
| World | DW News | https://rss.dw.com/xml/rss-en-all | `world-dw-rss` |
| Kenya | BBC Africa | https://feeds.bbci.co.uk/news/world/africa/rss.xml | `kenya-bbc-africa-rss` |
| Kenya | Google News Kenya | https://news.google.com/rss?hl=en-KE&gl=KE&ceid=KE:en | `kenya-google-news-rss` |

The existing Sky Sports feed remains separate as `sky-sports-rss`.

## Storage and deduplication

The project currently has no `explore_feed` table or `sync-explore-hubs` function. The existing `football_announcements` table already stores the required publisher, headline, summary, URL and publication timestamp fields, and has a unique constraint on `(provider, provider_id)`. World/Kenya rows reuse that table; the provider prefix identifies the vertical. No news table is added.

The public read policy is limited to rows with `is_published = true`. RSS ingestion remains server-side in the existing, authenticated `football-content-sync` Edge Function.

## Refresh and retention

The existing `nexora-arena-content-sync` pg_cron job already invokes `football-content-sync` every 15 minutes. The RSS sources are added to that same run, so there is no duplicate scheduler or additional Edge Function.

A separate daily cleanup job named `nexora-prune-old-news` removes only World/Kenya RSS rows older than seven days. It must not delete Sky Sports or other football announcements:

```sql
select cron.schedule(
  'nexora-prune-old-news',
  '0 3 * * *',
  $$
  delete from public.football_announcements
  where provider in (
    'world-bbc-rss',
    'world-aljazeera-rss',
    'world-dw-rss',
    'kenya-bbc-africa-rss',
    'kenya-google-news-rss'
  )
  and published_at < now() - interval '7 days';
  $$
);
```

## App surfaces

- Home: Morning Briefing displays the five newest World/Kenya headlines.
- Explore: World Daily News has All, World and Kenya filters.
- Videos: the existing News category displays the same publisher feed.
- Lite reader: text-only headlines, publisher, and relative publication time; opening a headline takes the reader to its HTTPS publisher/Google News source link.
- Sharing: each headline offers the device share sheet or a copy-link fallback. This does not create an in-app reaction counter or poll.

Google News RSS titles may append a publisher after the final ` - `. The parser uses the RSS `source` element when present and the final title suffix as a fallback.
