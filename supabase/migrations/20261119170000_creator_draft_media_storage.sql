-- Durable, account-scoped creator drafts and private media storage.
insert into storage.buckets (id, name, public)
values ('creator-drafts', 'creator-drafts', false)
on conflict (id) do update set public = false;

create table if not exists public.creator_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  media_paths text[] not null default '{}',
  media_type text,
  content_type text not null default 'post' check (content_type in ('reel', 'post', 'carousel', 'video', 'story', 'live', 'ad')),
  tags text[] not null default '{}',
  audience text not null default 'public' check (audience in ('public', 'private')),
  filter text not null default 'original',
  format text not null default 'square',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_drafts_user_id_id_unique unique (user_id, id)
);

create index if not exists creator_drafts_user_updated_idx
  on public.creator_drafts (user_id, updated_at desc);

alter table public.creator_drafts enable row level security;
grant select, insert, update, delete on public.creator_drafts to authenticated;

drop policy if exists creator_drafts_select_own on public.creator_drafts;
create policy creator_drafts_select_own on public.creator_drafts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists creator_drafts_insert_own on public.creator_drafts;
create policy creator_drafts_insert_own on public.creator_drafts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists creator_drafts_update_own on public.creator_drafts;
create policy creator_drafts_update_own on public.creator_drafts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists creator_drafts_delete_own on public.creator_drafts;
create policy creator_drafts_delete_own on public.creator_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists creator_drafts_media_select_own on storage.objects;
create policy creator_drafts_media_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'creator-drafts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists creator_drafts_media_insert_own on storage.objects;
create policy creator_drafts_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-drafts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists creator_drafts_media_update_own on storage.objects;
create policy creator_drafts_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'creator-drafts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'creator-drafts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists creator_drafts_media_delete_own on storage.objects;
create policy creator_drafts_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creator-drafts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
