create or replace function public.increment_post_views(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_viewer uuid := auth.uid();
  post_owner uuid;
  post_audience text;
  resulting_count integer;
  inserted_rows integer;
begin
  if current_viewer is null then raise exception 'Authentication required'; end if;

  select user_id, audience into post_owner, post_audience
  from public.user_media_posts
  where id = target_post_id;

  if post_owner is null then raise exception 'Post not found'; end if;

  if post_owner <> current_viewer
     and post_audience <> 'public'
     and not (post_audience = 'subscribers' and public.is_active_creator_subscriber(post_owner)) then
    raise exception 'Not authorized to record a view for this content';
  end if;

  if post_owner = current_viewer then
    select coalesce(view_count, 0) into resulting_count
    from public.user_media_posts where id = target_post_id;
    return coalesce(resulting_count, 0);
  end if;

  insert into public.user_media_post_views (post_id, creator_id, viewer_id, viewed_on)
  values (target_post_id, post_owner, current_viewer, timezone('utc', now())::date)
  on conflict (post_id, viewer_id, viewed_on) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.user_media_posts
    set view_count = coalesce(view_count, 0) + 1
    where id = target_post_id
    returning view_count into resulting_count;
  else
    select coalesce(view_count, 0) into resulting_count
    from public.user_media_posts where id = target_post_id;
  end if;

  return coalesce(resulting_count, 0);
end;
$$;
revoke all on function public.increment_post_views(uuid) from public, anon;
grant execute on function public.increment_post_views(uuid) to authenticated;