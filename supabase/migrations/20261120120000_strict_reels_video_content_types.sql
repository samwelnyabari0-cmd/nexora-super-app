-- Strict classification for creator media. Existing access policies and engagement
-- tables are intentionally unchanged.
alter table public.user_media_posts
  add column if not exists content_type text,
  add column if not exists aspect_ratio text,
  add column if not exists duration_seconds integer;

-- Preserve explicit legacy Reel/Video/Collab tags. Unclassified legacy videos
-- are safely treated as Videos rather than guessed to be vertical Reels.
update public.user_media_posts
set content_type = case
  when tags @> array['nx-type-reel']::text[]
    or tags @> array['reel']::text[]
    or tags @> array['short']::text[] then 'reel'
  when tags @> array['nx-type-collab']::text[]
    or tags @> array['collab']::text[] then 'collab'
  when tags @> array['nx-type-video']::text[] then 'video'
  when coalesce(media_type, '') like 'video/%' then 'video'
  else 'post'
end
where content_type is null;

alter table public.user_media_posts
  alter column content_type set default 'post',
  alter column content_type set not null;

alter table public.user_media_posts
  drop constraint if exists user_media_posts_content_type_check,
  add constraint user_media_posts_content_type_check
    check (content_type in ('post', 'reel', 'video', 'collab')),
  drop constraint if exists user_media_posts_duration_seconds_check,
  add constraint user_media_posts_duration_seconds_check
    check (duration_seconds is null or duration_seconds >= 0),
  drop constraint if exists user_media_posts_aspect_ratio_check,
  add constraint user_media_posts_aspect_ratio_check
    check (aspect_ratio is null or aspect_ratio ~ '^[0-9]+:[0-9]+$');

create index if not exists user_media_posts_content_type_created_idx
  on public.user_media_posts (content_type, created_at desc);

create index if not exists user_media_posts_user_content_type_created_idx
  on public.user_media_posts (user_id, content_type, created_at desc);
