alter table public.profiles alter column discoverable set default true;
update public.profiles set discoverable = true where discoverable is distinct from true;

drop policy if exists "Anyone can view public posts" on public.user_media_posts;
drop policy if exists "Active subscribers can view subscriber posts" on public.user_media_posts;
create policy "View media allowed by audience and profile privacy"
on public.user_media_posts for select to authenticated
using (
  user_id = (select auth.uid())
  or (audience = 'public' and (
    not coalesce((select p.private_profile from public.profiles p where p.id = user_media_posts.user_id), false)
    or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = user_media_posts.user_id)
  ))
  or (audience = 'subscribers' and public.is_active_creator_subscriber(user_id) and (
    not coalesce((select p.private_profile from public.profiles p where p.id = user_media_posts.user_id), false)
    or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = user_media_posts.user_id)
  ))
);

alter table public.user_media_post_views add column if not exists playback_id uuid not null default gen_random_uuid();
alter table public.user_media_post_views drop constraint if exists user_media_post_views_unique_daily;
create unique index if not exists user_media_post_views_playback_id_key on public.user_media_post_views(playback_id);

create or replace function public.increment_post_views(target_post_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  current_viewer uuid := auth.uid();
  post_owner uuid;
  post_audience text;
  owner_is_private boolean;
  resulting_count integer;
begin
  if current_viewer is null then raise exception 'Authentication required'; end if;
  select p.user_id, p.audience, coalesce(pr.private_profile, false)
    into post_owner, post_audience, owner_is_private
  from public.user_media_posts p left join public.profiles pr on pr.id = p.user_id
  where p.id = target_post_id;
  if post_owner is null then raise exception 'Post not found'; end if;
  if post_owner = current_viewer then
    select coalesce(view_count, 0) into resulting_count from public.user_media_posts where id = target_post_id;
    return coalesce(resulting_count, 0);
  end if;
  if post_audience = 'private'
    or (post_audience = 'subscribers' and not public.is_active_creator_subscriber(post_owner))
    or (owner_is_private and not exists (
      select 1 from public.follows f where f.follower_id = current_viewer and f.following_id = post_owner
    ))
  then raise exception 'Not authorized to record a view for this content'; end if;
  insert into public.user_media_post_views (post_id, creator_id, viewer_id, viewed_on)
  values (target_post_id, post_owner, current_viewer, timezone('utc', now())::date);
  update public.user_media_posts set view_count = coalesce(view_count, 0) + 1
  where id = target_post_id returning view_count into resulting_count;
  return coalesce(resulting_count, 0);
end;
$function$;

create table if not exists public.user_media_post_saves (
  post_id uuid not null references public.user_media_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.user_media_post_saves enable row level security;
drop policy if exists "Users manage their own media saves" on public.user_media_post_saves;
create policy "Users manage their own media saves" on public.user_media_post_saves
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.user_media_post_saves to authenticated;
