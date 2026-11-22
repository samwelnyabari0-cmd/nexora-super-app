create table if not exists public.user_media_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.user_media_posts(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_on date not null default (timezone('utc', now())::date),
  created_at timestamptz not null default now(),
  constraint user_media_post_views_unique_daily unique (post_id, viewer_id, viewed_on)
);
create index if not exists user_media_post_views_creator_date_idx on public.user_media_post_views (creator_id, viewed_on, post_id);
alter table public.user_media_post_views enable row level security;
drop policy if exists "Creators can read views for their own content" on public.user_media_post_views;
create policy "Creators can read views for their own content" on public.user_media_post_views for select to authenticated using ((select auth.uid()) = creator_id);
revoke all on public.user_media_post_views from anon, authenticated;
grant select on public.user_media_post_views to authenticated;
create or replace function public.increment_post_views(target_post_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_viewer uuid := auth.uid();
  post_owner uuid;
  resulting_count integer;
  inserted_rows integer;
begin
  if current_viewer is null then raise exception 'Authentication required'; end if;
  select user_id into post_owner from public.user_media_posts where id = target_post_id;
  if post_owner is null then raise exception 'Post not found'; end if;
  if post_owner = current_viewer then
    select coalesce(view_count, 0) into resulting_count from public.user_media_posts where id = target_post_id;
    return coalesce(resulting_count, 0);
  end if;
  insert into public.user_media_post_views (post_id, creator_id, viewer_id, viewed_on)
  values (target_post_id, post_owner, current_viewer, timezone('utc', now())::date)
  on conflict (post_id, viewer_id, viewed_on) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.user_media_posts set view_count = coalesce(view_count, 0) + 1 where id = target_post_id returning view_count into resulting_count;
  else
    select coalesce(view_count, 0) into resulting_count from public.user_media_posts where id = target_post_id;
  end if;
  return coalesce(resulting_count, 0);
end;
$$;
revoke all on function public.increment_post_views(uuid) from public, anon;
grant execute on function public.increment_post_views(uuid) to authenticated;
