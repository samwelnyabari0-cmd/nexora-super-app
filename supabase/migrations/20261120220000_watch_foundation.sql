-- Nexora Watch catalogue and private playback progress.
create table if not exists public.watch_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  category text not null check (length(btrim(category)) > 0),
  content_type text not null default 'single' check (content_type in ('single', 'series')),
  release_year integer check (release_year is null or release_year between 1888 and 2200),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  thumbnail_url text not null,
  banner_url text not null,
  hls_manifest_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready')),
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_titles_ready_manifest_check
    check (status <> 'ready' or (hls_manifest_url is not null and length(btrim(hls_manifest_url)) > 0))
);

create table if not exists public.watch_episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.watch_titles(id) on delete cascade,
  season_number integer not null default 1 check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  episode_title text not null check (length(btrim(episode_title)) > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  hls_manifest_url text,
  thumbnail_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready')),
  created_at timestamptz not null default now(),
  constraint watch_episodes_order_unique unique (title_id, season_number, episode_number),
  constraint watch_episodes_id_title_unique unique (id, title_id),
  constraint watch_episodes_ready_manifest_check
    check (status <> 'ready' or (hls_manifest_url is not null and length(btrim(hls_manifest_url)) > 0))
);

create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.watch_titles(id) on delete cascade,
  episode_id uuid,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  total_seconds integer not null check (total_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id),
  constraint watch_progress_episode_title_fkey
    foreign key (episode_id, title_id)
    references public.watch_episodes(id, title_id)
    on delete set null (episode_id)
);

create index if not exists watch_titles_published_category_idx
  on public.watch_titles (category, is_featured desc, created_at desc)
  where is_published is true;
create index if not exists watch_episodes_title_order_idx
  on public.watch_episodes (title_id, season_number, episode_number);
create index if not exists watch_progress_user_updated_idx
  on public.watch_progress (user_id, updated_at desc);

alter table public.watch_titles enable row level security;
alter table public.watch_episodes enable row level security;
alter table public.watch_progress enable row level security;

revoke all on public.watch_titles, public.watch_episodes, public.watch_progress from anon, authenticated;
grant select on public.watch_titles, public.watch_episodes to anon, authenticated;
grant select, insert, update on public.watch_progress to authenticated;

drop policy if exists watch_titles_public_read on public.watch_titles;
create policy watch_titles_public_read on public.watch_titles
for select to anon, authenticated
using (is_published is true);

drop policy if exists watch_episodes_public_read on public.watch_episodes;
create policy watch_episodes_public_read on public.watch_episodes
for select to anon, authenticated
using (
  exists (
    select 1 from public.watch_titles t
    where t.id = watch_episodes.title_id
      and t.is_published is true
  )
);

drop policy if exists watch_progress_select_own on public.watch_progress;
create policy watch_progress_select_own on public.watch_progress
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists watch_progress_insert_own on public.watch_progress;
create policy watch_progress_insert_own on public.watch_progress
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists watch_progress_update_own on public.watch_progress;
create policy watch_progress_update_own on public.watch_progress
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
