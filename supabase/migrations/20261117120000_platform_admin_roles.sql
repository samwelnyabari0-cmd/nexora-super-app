-- Establish explicit platform administrator roles for Nexora Platform Settings.
-- Promote the sole verified existing administrator; abort if membership is not exactly one.

begin;

alter table private.platform_admins
  add column if not exists role text not null default 'admin';

alter table private.platform_admins
  drop constraint if exists platform_admins_role_check;

alter table private.platform_admins
  add constraint platform_admins_role_check
  check (role in ('admin', 'super_admin'));

DO $$
declare
  existing_admin_count integer;
begin
  select count(*) into existing_admin_count
  from private.platform_admins;

  if existing_admin_count <> 1 then
    raise exception 'Expected exactly one existing platform administrator; found %. Aborting role migration.', existing_admin_count;
  end if;

  update private.platform_admins
  set role = 'super_admin'
  where user_id = (select user_id from private.platform_admins);
end;
$$;

create or replace function public.is_platform_super_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.platform_admins
    where user_id = p_user_id
      and role = 'super_admin'
  );
$function$;

revoke all on function public.is_platform_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_super_admin(uuid) to service_role;

commit;
