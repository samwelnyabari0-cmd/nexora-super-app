-- Enforce that RPCs work only for rows in the canonical table.
create or replace function public.increment_post_views(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.user_media_posts
  set view_count = coalesce(view_count, 0) + 1
  where id = target_post_id
  returning view_count into updated_count;
  if not found then raise exception 'Post not found'; end if;
  return updated_count;
end;
$$;

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
  if current_user_id is null then raise exception 'Authentication required'; end if;
  insert into public.user_media_post_likes(post_id, user_id)
  values (target_post_id, current_user_id)
  on conflict (post_id, user_id) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.user_media_posts
    set like_count = coalesce(like_count, 0) + 1
    where id = target_post_id returning like_count into resulting_count;
  else
    select like_count into resulting_count from public.user_media_posts where id = target_post_id;
  end if;
  if not exists (select 1 from public.user_media_posts where id = target_post_id) then
    raise exception 'Post not found';
  end if;
  return coalesce(resulting_count, 0);
end;
$$;

create or replace function public.unlike_user_media_post(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_rows integer;
  resulting_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.user_media_post_likes
  where post_id = target_post_id and user_id = current_user_id;
  get diagnostics deleted_rows = row_count;
  if deleted_rows > 0 then
    update public.user_media_posts
    set like_count = greatest(coalesce(like_count, 0) - 1, 0)
    where id = target_post_id returning like_count into resulting_count;
  else
    select like_count into resulting_count from public.user_media_posts where id = target_post_id;
  end if;
  if not exists (select 1 from public.user_media_posts where id = target_post_id) then
    raise exception 'Post not found';
  end if;
  return coalesce(resulting_count, 0);
end;
$$;

create or replace function public.add_user_media_post_comment(target_post_id uuid, comment_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_comment_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if comment_text is null or char_length(btrim(comment_text)) not between 1 and 5000 then
    raise exception 'Comment must contain between 1 and 5000 characters';
  end if;
  insert into public.user_media_post_comments(post_id, user_id, text)
  values (target_post_id, current_user_id, btrim(comment_text))
  returning id into new_comment_id;
  update public.user_media_posts
  set comment_count = coalesce(comment_count, 0) + 1
  where id = target_post_id;
  if not found then raise exception 'Post not found'; end if;
  return new_comment_id;
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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.user_media_posts
  set share_count = coalesce(share_count, 0) + 1
  where id = target_post_id returning share_count into resulting_count;
  if not found then raise exception 'Post not found'; end if;
  return resulting_count;
end;
$$;

revoke all on function public.increment_post_views(uuid) from public, anon;
revoke all on function public.like_user_media_post(uuid) from public, anon;
revoke all on function public.unlike_user_media_post(uuid) from public, anon;
revoke all on function public.add_user_media_post_comment(uuid, text) from public, anon;
revoke all on function public.increment_user_media_post_shares(uuid) from public, anon;
grant execute on function public.increment_post_views(uuid) to authenticated;
grant execute on function public.like_user_media_post(uuid) to authenticated;
grant execute on function public.unlike_user_media_post(uuid) to authenticated;
grant execute on function public.add_user_media_post_comment(uuid, text) to authenticated;
grant execute on function public.increment_user_media_post_shares(uuid) to authenticated;
