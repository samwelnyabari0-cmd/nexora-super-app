-- Cache successful and unsuccessful article-image lookups to avoid repeated publisher requests.
alter table public.football_announcements
  add column if not exists thumbnail_checked_at timestamptz;
