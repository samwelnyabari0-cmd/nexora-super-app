alter table public.user_media_posts
  add column if not exists framing_aspect_ratio text not null default 'original',
  add column if not exists focal_x double precision not null default 50,
  add column if not exists focal_y double precision not null default 50,
  add column if not exists zoom double precision not null default 1,
  add column if not exists dominant_color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_media_posts_focal_x_range') then
    alter table public.user_media_posts
      add constraint user_media_posts_focal_x_range check (focal_x between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_media_posts_focal_y_range') then
    alter table public.user_media_posts
      add constraint user_media_posts_focal_y_range check (focal_y between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_media_posts_zoom_range') then
    alter table public.user_media_posts
      add constraint user_media_posts_zoom_range check (zoom between 1 and 3);
  end if;
end $$;
