-- Hybrid media storage metadata.
-- Existing rows remain on Supabase Storage; R2 is opt-in for new uploads.
alter table public.user_media_posts
  add column if not exists media_storage_provider text not null default 'supabase',
  add column if not exists media_storage_key text,
  add column if not exists thumbnail_storage_provider text not null default 'supabase',
  add column if not exists thumbnail_storage_key text;

alter table public.user_media_posts
  drop constraint if exists user_media_posts_media_storage_provider_check,
  add constraint user_media_posts_media_storage_provider_check
    check (media_storage_provider in ('supabase', 'r2')),
  drop constraint if exists user_media_posts_thumbnail_storage_provider_check,
  add constraint user_media_posts_thumbnail_storage_provider_check
    check (thumbnail_storage_provider in ('supabase', 'r2')),
  drop constraint if exists user_media_posts_media_r2_key_check,
  add constraint user_media_posts_media_r2_key_check
    check (media_storage_provider <> 'r2' or media_storage_key is not null),
  drop constraint if exists user_media_posts_thumbnail_r2_key_check,
  add constraint user_media_posts_thumbnail_r2_key_check
    check (thumbnail_storage_provider <> 'r2' or thumbnail_storage_key is not null);

comment on column public.user_media_posts.media_storage_provider is
  'Storage backend for media_url. Existing records default to Supabase.';
comment on column public.user_media_posts.media_storage_key is
  'Private object key when media_storage_provider is r2; never a public URL.';
comment on column public.user_media_posts.thumbnail_storage_provider is
  'Storage backend for thumbnail_url. Existing records default to Supabase.';
comment on column public.user_media_posts.thumbnail_storage_key is
  'Private object key when thumbnail_storage_provider is r2; never a public URL.';
