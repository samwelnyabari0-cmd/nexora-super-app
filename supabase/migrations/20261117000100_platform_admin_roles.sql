-- Establish explicit platform administrator roles for Nexora Platform Settings.
-- The existing platform administrator is promoted by stable user ID, not email.
-- This migration is staged for review and has NOT been applied to the hosted database.

begin;

alter table private.platform_admins
  add column if not exists role text not null default 'admin';

alter table private.platform_admins
  drop constraint if exists platform_admins_role_check;

alter table private.platform_admins
  add constraint platform_admins_role_check
  check (role in ('admin', 'super_admin'));

update private.platform_admins
set role = 'super_admin'
where user_id = '5e072a58-2a91-497f-9fec-31c1a0df1780'::uuid;

create or replace function public.is_platform_super_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    auth.role() = 'service_role'
    and exists (
      select 1
      from private.platform_admins
      where user_id = p_user_id
        and role = 'super_admin'
    );
$function$;

revoke all on function public.is_platform_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_super_admin(uuid) to service_role;

commit;
