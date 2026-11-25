-- Store publisher-supplied story artwork for the Nexora World & Kenya news feed.
alter table public.football_announcements
  add column if not exists thumbnail_url text;

alter table public.football_announcements
  drop constraint if exists football_announcements_thumbnail_url_https_check;

alter table public.football_announcements
  add constraint football_announcements_thumbnail_url_https_check
  check (thumbnail_url is null or thumbnail_url ~ '^https://');
