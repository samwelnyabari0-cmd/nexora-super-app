create or replace function public.get_public_profile_by_id(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  handle text,
  bio text,
  private_profile boolean,
  settings jsonb,
  avatar_url text,
  account_type text,
  profile_category text,
  bio_links jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id,
    p.display_name,
    p.handle,
    p.bio,
    coalesce(p.private_profile, false),
    case
      when p.id = (select auth.uid()) then coalesce(p.settings, '{}'::jsonb)
      else '{}'::jsonb
    end,
    p.avatar_url,
    coalesce(p.account_type, 'personal'),
    p.profile_category,
    coalesce(p.bio_links, '[]'::jsonb)
  from public.profiles p
  where p.id = p_user_id
    and case
      when (select auth.uid()) is null then true
      else not public.is_my_account_suspended()
    end
    and (
      p.discoverable is true
      or coalesce(p.private_profile, false) is false
      or p.id = (select auth.uid())
    )
  limit 1;
$function$;

revoke all on function public.get_public_profile_by_id(uuid) from public, anon;
grant execute on function public.get_public_profile_by_id(uuid) to anon, authenticated;
