-- Make user_media_posts the application post source and enforce owner/public access.
-- These columns are optional to support text-only feed posts; older rows remain valid.
alter table public.user_media_posts
  alter column media_type drop not null,
  alter column media_url drop not null,
  alter column thumbnail_url drop not null;

alter table public.user_media_posts
  add column if not exists audience text not null default 'public'
    check (audience in ('public', 'private')),
  add column if not exists tags text[] not null default '{}';

-- RLS was enabled without policies, which blocks normal client access.
drop policy if exists "Public posts are readable" on public.user_media_posts;
drop policy if exists "Owners can insert their posts" on public.user_media_posts;
drop policy if exists "Owners can update their posts" on public.user_media_posts;
drop policy if exists "Owners can delete their posts" on public.user_media_posts;

create policy "Public posts are readable"
  on public.user_media_posts for select to anon, authenticated
  using (audience = 'public' or user_id = (select auth.uid()));

create policy "Owners can insert their posts"
  on public.user_media_posts for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners can update their posts"
  on public.user_media_posts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Owners can delete their posts"
  on public.user_media_posts for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.user_media_posts to anon, authenticated;
grant insert, update, delete on public.user_media_posts to authenticated;
