-- Ensure profile engagement RPCs only operate on posts the viewer is allowed to see.
-- This mirrors the public/subscriber/private-profile visibility rules used by media comments.

create or replace function public.can_view_user_media_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_media_posts p
    where p.id = target_post_id
      and (
        p.user_id = (select auth.uid())
        or (
          p.audience = 'public'
          and (
            not coalesce(
              (select pr.private_profile from public.profiles pr where pr.id = p.user_id),
              false
            )
            or exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid())
                and f.following_id = p.user_id
            )
          )
        )
        or (
          p.audience = 'subscribers'
          and public.is_active_creator_subscriber(p.user_id)
          and (
            not coalesce(
              (select pr.private_profile from public.profiles pr where pr.id = p.user_id),
              false
            )
            or exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid())
                and f.following_id = p.user_id
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_view_user_media_post(uuid) from public, anon;
grant execute on function public.can_view_user_media_post(uuid) to authenticated;

create or replace function public.like_user_media_post(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_rows integer;
  resulting_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if public.is_my_account_suspended() then
    raise exception 'This account has been suspended';
  end if;
  if not public.can_view_user_media_post(target_post_id) then
    raise exception 'Post not found or not available';
  end if;

  insert into public.user_media_post_likes(post_id, user_id)
  values (target_post_id, current_user_id)
  on conflict (post_id, user_id) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows > 0 then
    update public.user_media_posts
    set like_count = coalesce(like_count, 0) + 1
    where id = target_post_id
    returning like_count into resulting_count;
  else
    select like_count into resulting_count
    from public.user_media_posts where id = target_post_id;
  end if;

  return coalesce(resulting_count, 0);
end;
$$;

create or replace function public.repost_user_media_post(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_post_id uuid;
  resulting_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if public.is_my_account_suspended() then
    raise exception 'This account has been suspended';
  end if;
  if not public.can_view_user_media_post(target_post_id) then
    raise exception 'Post not found or not available';
  end if;

  insert into public.user_media_post_reposts(post_id, user_id)
  values (target_post_id, current_user_id)
  on conflict (post_id, user_id) do nothing
  returning post_id into inserted_post_id;

  if inserted_post_id is not null then
    update public.user_media_posts
    set repost_count = coalesce(repost_count, 0) + 1
    where id = target_post_id
    returning repost_count into resulting_count;
  else
    select coalesce(repost_count, 0) into resulting_count
    from public.user_media_posts where id = target_post_id;
  end if;

  if resulting_count is null then
    raise exception 'Post not found';
  end if;
  return resulting_count;
end;
$$;

create or replace function public.increment_user_media_post_shares(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if public.is_my_account_suspended() then
    raise exception 'This account has been suspended';
  end if;
  if not public.can_view_user_media_post(target_post_id) then
    raise exception 'Post not found or not available';
  end if;

  update public.user_media_posts
  set share_count = coalesce(share_count, 0) + 1
  where id = target_post_id
  returning share_count into resulting_count;

  if not found then
    raise exception 'Post not found';
  end if;
  return resulting_count;
end;
$$;

revoke all on function public.like_user_media_post(uuid) from public, anon;
revoke all on function public.repost_user_media_post(uuid) from public, anon;
revoke all on function public.increment_user_media_post_shares(uuid) from public, anon;
grant execute on function public.like_user_media_post(uuid) to authenticated;
grant execute on function public.repost_user_media_post(uuid) to authenticated;
grant execute on function public.increment_user_media_post_shares(uuid) to authenticated;
