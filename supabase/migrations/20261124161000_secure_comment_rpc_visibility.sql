-- Preserve the visibility restrictions formerly enforced by direct comment INSERT RLS.
-- The SECURITY DEFINER RPC must enforce the same access rule itself.
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
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if comment_text is null or char_length(btrim(comment_text)) not between 1 and 5000 then
    raise exception 'Comment must contain between 1 and 5000 characters';
  end if;

  if not exists (
    select 1
    from public.user_media_posts p
    where p.id = target_post_id
      and (
        p.user_id = current_user_id
        or (
          p.audience = 'public'
          and (
            not coalesce(
              (select pr.private_profile from public.profiles pr where pr.id = p.user_id),
              false
            )
            or exists (
              select 1 from public.follows f
              where f.follower_id = current_user_id
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
              where f.follower_id = current_user_id
                and f.following_id = p.user_id
            )
          )
        )
      )
  ) then
    raise exception 'Post not found or not available';
  end if;

  insert into public.user_media_post_comments(post_id, user_id, text)
  values (target_post_id, current_user_id, btrim(comment_text))
  returning id into new_comment_id;

  update public.user_media_posts
  set comment_count = coalesce(comment_count, 0) + 1
  where id = target_post_id;

  return new_comment_id;
end;
$$;

revoke all on function public.add_user_media_post_comment(uuid, text) from public, anon;
grant execute on function public.add_user_media_post_comment(uuid, text) to authenticated;
