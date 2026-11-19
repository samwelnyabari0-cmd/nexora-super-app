alter table public.profiles
  add column if not exists education_skills text[] not null default '{}'::text[];

create or replace view public.academy_educator_directory
with (security_barrier = true)
as
select
  p.id,
  p.display_name,
  p.handle,
  p.bio,
  p.avatar_url,
  p.account_type,
  p.profile_category,
  p.education_skills
from public.profiles as p
where p.account_type in ('creator', 'business')
  and p.profile_category = 'education'
  and p.discoverable is true
  and p.private_profile is false;

revoke all on public.academy_educator_directory from public;
grant select on public.academy_educator_directory to anon, authenticated;
