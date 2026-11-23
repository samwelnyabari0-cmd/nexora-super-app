drop function if exists public.get_academy_community_feed(integer);

create function public.get_academy_community_feed(p_limit integer default 60)
returns table (
  id uuid,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_url text,
  caption text,
  media_url text,
  media_type text,
  thumbnail_url text,
  media_storage_provider text,
  media_storage_key text,
  thumbnail_storage_provider text,
  thumbnail_storage_key text,
  content_type text,
  created_at timestamptz,
  view_count integer,
  like_count integer,
  share_count integer,
  save_count integer,
  repost_count integer,
  total_engagement bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.user_id,
    coalesce(p.display_name, p.handle, 'Education creator'),
    p.handle,
    p.avatar_url,
    m.caption,
    m.media_url,
    m.media_type,
    m.thumbnail_url,
    m.media_storage_provider,
    m.media_storage_key,
    m.thumbnail_storage_provider,
    m.thumbnail_storage_key,
    m.content_type,
    m.created_at,
    coalesce(m.view_count, 0)::integer,
    coalesce(likes.total, 0)::integer,
    coalesce(m.share_count, 0)::integer,
    coalesce(saves.total, 0)::integer,
    coalesce(reposts.total, 0)::integer,
    (
      coalesce(m.view_count, 0)::bigint
      + coalesce(likes.total, 0)
      + coalesce(m.share_count, 0)::bigint
      + coalesce(saves.total, 0)
      + coalesce(reposts.total, 0)
    )::bigint
  from public.user_media_posts as m
  join public.profiles as p on p.id = m.user_id
  left join lateral (
    select count(*)::bigint as total
    from public.user_media_post_likes as l
    where l.post_id = m.id
  ) as likes on true
  left join lateral (
    select count(*)::bigint as total
    from public.user_media_post_bookmarks as b
    where b.post_id = m.id
  ) as saves on true
  left join lateral (
    select count(*)::bigint as total
    from public.user_media_post_reposts as r
    where r.post_id = m.id
  ) as reposts on true
  where p.profile_category = 'education'
    and p.discoverable is true
    and p.private_profile is false
    and m.audience = 'public'
  order by m.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 60), 100));
end;
$$;

revoke all on function public.get_academy_community_feed(integer) from public, anon;
grant execute on function public.get_academy_community_feed(integer) to authenticated;
