drop policy if exists "posts_public_or_own_select" on public.posts;
create policy "Posts visible by audience and profile privacy" on public.posts
for select to authenticated
using (
  author_id = (select auth.uid())
  or (audience = 'public' and (
    not coalesce((select p.private_profile from public.profiles p where p.id = posts.author_id), false)
    or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = posts.author_id)
  ))
);

drop policy if exists "post_comments_select_visible_posts" on public.post_comments;
create policy "post_comments_select_visible_posts" on public.post_comments
for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_comments.post_id and (
    p.author_id = (select auth.uid())
    or (p.audience = 'public' and (
      not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.author_id), false)
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.author_id)
    ))
  ))
);

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments
for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = post_comments.post_id and (
    p.author_id = (select auth.uid())
    or (p.audience = 'public' and (
      not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.author_id), false)
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.author_id)
    ))
  ))
);

drop policy if exists "Anyone can view post comments" on public.user_media_post_comments;
create policy "View media comments when content is visible" on public.user_media_post_comments
for select to authenticated using (
  exists (select 1 from public.user_media_posts p where p.id = user_media_post_comments.post_id and (
    p.user_id = (select auth.uid())
    or (p.audience = 'public' and (
      not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.user_id), false)
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id)
    ))
    or (p.audience = 'subscribers' and public.is_active_creator_subscriber(p.user_id) and (
      not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.user_id), false)
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id)
    ))
  ))
);

drop policy if exists "Authenticated users can add their own comments" on public.user_media_post_comments;
create policy "Authenticated users can comment on visible media"
on public.user_media_post_comments for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.user_media_posts p
    where p.id = user_media_post_comments.post_id
      and (
        p.user_id = (select auth.uid())
        or (
          p.audience = 'public'
          and (
            not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.user_id), false)
            or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id)
          )
        )
        or (
          p.audience = 'subscribers'
          and public.is_active_creator_subscriber(p.user_id)
          and (
            not coalesce((select pr.private_profile from public.profiles pr where pr.id = p.user_id), false)
            or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id)
          )
        )
      )
  )
);
