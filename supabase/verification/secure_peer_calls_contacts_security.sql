-- Run after applying 20261126130000_secure_peer_calls_contacts.sql.
-- Read-only structural/security assertions. This script does not mutate data.

do $verification$
declare
  v_rls boolean;
  v_definition text;
begin
  if to_regclass('public.contacts') is null then
    raise exception 'public.contacts is missing';
  end if;
  if to_regclass('public.call_invites') is null then
    raise exception 'public.call_invites is missing';
  end if;

  select relrowsecurity into v_rls
  from pg_class where oid = 'public.contacts'::regclass;
  if v_rls is not true then
    raise exception 'RLS must be enabled on contacts';
  end if;

  select relrowsecurity into v_rls
  from pg_class where oid = 'public.call_invites'::regclass;
  if v_rls is not true then
    raise exception 'RLS must be enabled on call_invites';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contacts'
      and column_name = 'blocked_by' and data_type = 'uuid'
  ) then
    raise exception 'contacts.blocked_by must exist';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contacts'::regclass
      and conname = 'contacts_status_check'
      and pg_get_constraintdef(oid) like '%blocked%'
  ) then
    raise exception 'contacts must allow the blocked status';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contacts'
      and policyname = 'contacts_request' and cmd = 'INSERT'
      and with_check like '%can_request_contact%'
  ) then
    raise exception 'Contact requests must use the block-aware request predicate';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'call_invites'
      and policyname = 'calls_create' and cmd = 'INSERT'
      and with_check like '%are_contacts%'
  ) then
    raise exception 'Call creation must require an accepted contact relationship';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.call_invites'::regclass
      and tgname = 'call_invites_guard' and not tgisinternal
  ) then
    raise exception 'The call transition guard trigger must exist';
  end if;

  if has_function_privilege('anon', 'public.block_contact(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.unblock_contact(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rotate_contact_invite()', 'EXECUTE')
     or has_function_privilege('anon', 'public.redeem_invite(text)', 'EXECUTE') then
    raise exception 'Anonymous clients must not execute contact management RPCs';
  end if;

  if not has_function_privilege('authenticated', 'public.block_contact(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unblock_contact(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rotate_contact_invite()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.redeem_invite(text)', 'EXECUTE') then
    raise exception 'Authenticated clients must be able to use the intended contact RPCs';
  end if;

  select pg_get_functiondef('private.call_invite_guard()'::regprocedure)
    into v_definition;
  if position('immutable' in lower(v_definition)) = 0
     or position('recipient' in lower(v_definition)) = 0
     or position('blocked' in lower(v_definition)) = 0 then
    raise exception 'Call guard must enforce immutable participants, recipient-only acceptance and block checks';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'call_invites'
  ) then
    raise exception 'call_invites must be in supabase_realtime';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'contacts'
  ) then
    raise exception 'contacts must be in supabase_realtime';
  end if;

  if position('gen_random_bytes' in pg_get_expr(
    (select adbin from pg_attrdef
     where adrelid = 'public.profiles'::regclass and adnum = (
       select attnum from pg_attribute
       where attrelid = 'public.profiles'::regclass and attname = 'invite_code'
     )),
    'public.profiles'::regclass
  )) = 0 then
    raise exception 'New invite codes must use cryptographically secure random bytes';
  end if;
end;
$verification$;

select
  (select count(*) from public.contacts where status = 'accepted') as accepted_contacts,
  (select count(*) from public.contacts where status = 'blocked') as blocked_contacts,
  (select count(*) from public.call_invites where status in ('ringing', 'accepted')) as active_calls;
