alter table public.football_announcements
  add column if not exists video_url text;

comment on column public.football_announcements.video_url is
  'Optional publisher-hosted or YouTube video URL attached to a news story.';
