-- Establish the PeerJS contact/call schema in Supabase and enforce contact consent.
-- The original call schema existed only in drizzle/migrations/0001_calls_contacts.sql
-- and was not present in the connected Supabase project when this migration was prepared.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.profiles
  add column if not exists discoverable boolean not null default false,
  add column if not exists invite_code text;

alter table public.profiles
  alter column invite_code set default encode(extensions.gen_random_bytes(24), 'hex');

update public.profiles
set invite_code = encode(extensions.gen_random_bytes(24), 'hex')
where invite_code is null;

create unique index if not exists profiles_invite_code_unique
  on public.profiles (invite_code);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  blocked_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);

alter table public.contacts
  add column if not exists blocked_by uuid references auth.users(id) on delete cascade;

alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts
  add constraint contacts_status_check
  check (status in ('pending', 'accepted', 'declined', 'blocked'));

alter table public.contacts drop constraint if exists contacts_block_metadata_check;
alter table public.contacts
  add constraint contacts_block_metadata_check
  check ((status = 'blocked' and blocked_by is not null) or (status <> 'blocked' and blocked_by is null));

create index if not exists contacts_requester_status_idx
  on public.contacts (requester, status, created_at desc);
create index if not exists contacts_addressee_status_idx
  on public.contacts (addressee, status, created_at desc);

create table if not exists public.call_invites (
  id uuid primary key default gen_random_uuid(),
  caller uuid not null references auth.users(id) on delete cascade,
  callee uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'ended')),
  callee_peer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (caller <> callee)
);

create index if not exists call_invites_caller_status_idx
  on public.call_invites (caller, status, created_at desc);
create index if not exists call_invites_callee_status_idx
  on public.call_invites (callee, status, created_at desc);

alter table public.contacts enable row level security;
alter table public.call_invites enable row level security;

create or replace function private.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() in (a, b)
    and exists (
      select 1 from public.contacts c
      where c.status = 'blocked'
        and ((c.requester = a and c.addressee = b)
          or (c.requester = b and c.addressee = a))
    );
$$;

create or replace function private.can_request_contact(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = a
    and a is not null
    and b is not null
    and a <> b
    and not private.is_blocked_pair(a, b)
    and not exists (
      select 1 from public.contacts c
      where ((c.requester = a and c.addressee = b)
          or (c.requester = b and c.addressee = a))
        and c.status in ('pending', 'accepted', 'blocked')
    );
$$;

grant execute on function private.is_blocked_pair(uuid, uuid) to authenticated;
grant execute on function private.can_request_contact(uuid, uuid) to authenticated;
revoke all on function private.is_blocked_pair(uuid, uuid) from anon, public;
revoke all on function private.can_request_contact(uuid, uuid) from anon, public;

drop policy if exists contacts_read on public.contacts;
create policy contacts_read on public.contacts
  for select to authenticated
  using (auth.uid() in (requester, addressee));

drop policy if exists contacts_request on public.contacts;
create policy contacts_request on public.contacts
  for insert to authenticated
  with check (
    status = 'pending'
    and blocked_by is null
    and private.can_request_contact(requester, addressee)
  );

drop policy if exists contacts_respond on public.contacts;
create policy contacts_respond on public.contacts
  for update to authenticated
  using (
    auth.uid() = addressee
    and status = 'pending'
    and not private.is_blocked_pair(requester, addressee)
  )
  with check (
    auth.uid() = addressee
    and status in ('accepted', 'declined')
    and blocked_by is null
    and not private.is_blocked_pair(requester, addressee)
  );

drop policy if exists contacts_remove on public.contacts;
create policy contacts_remove on public.contacts
  for delete to authenticated
  using (
    auth.uid() in (requester, addressee)
    and status <> 'blocked'
  );

create or replace function public.are_contacts(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() in (a, b)
    and not private.is_blocked_pair(a, b)
    and exists (
      select 1 from public.contacts c
      where c.status = 'accepted'
        and ((c.requester = a and c.addressee = b)
          or (c.requester = b and c.addressee = a))
    );
$$;

create or replace function public.search_directory(q text)
returns table (id uuid, display_name text, handle text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.handle, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and p.discoverable is true
    and p.private_profile is not true
    and p.id <> auth.uid()
    and length(trim(coalesce(q, ''))) >= 2
    and (
      p.display_name ilike '%' || trim(q) || '%'
      or p.handle ilike '%' || trim(q) || '%'
    )
    and not private.is_blocked_pair(auth.uid(), p.id)
  order by p.display_name
  limit 20;
$$;

create or replace function public.contact_names(ids uuid[])
returns table (id uuid, display_name text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.handle
  from public.profiles p
  where auth.uid() is not null
    and p.id = any(coalesce(ids, '{}'::uuid[]))
    and (
      exists (
        select 1 from public.contacts c
        where ((c.requester = auth.uid() and c.addressee = p.id)
            or (c.addressee = auth.uid() and c.requester = p.id))
      )
      or exists (
        select 1 from public.call_invites ci
        where auth.uid() in (ci.caller, ci.callee)
          and p.id in (ci.caller, ci.callee)
      )
    );
$$;

create or replace function public.redeem_invite(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if length(trim(coalesce(code, ''))) < 8 or length(trim(code)) > 64 then
    raise exception 'invalid invite';
  end if;

  select p.id into owner_id
  from public.profiles p
  where p.invite_code = trim(code);

  if owner_id is null or owner_id = auth.uid() then
    raise exception 'invalid invite';
  end if;

  if exists (
    select 1 from public.contacts c
    where c.status = 'blocked'
      and ((c.requester = owner_id and c.addressee = auth.uid())
        or (c.requester = auth.uid() and c.addressee = owner_id))
  ) then
    raise exception 'this contact is blocked';
  end if;

  delete from public.contacts
  where requester = auth.uid()
    and addressee = owner_id
    and status in ('pending', 'declined');

  insert into public.contacts as existing_contact (requester, addressee, status, blocked_by)
  values (owner_id, auth.uid(), 'accepted', null)
  on conflict (requester, addressee)
  do update set status = 'accepted', blocked_by = null
  where existing_contact.status <> 'blocked';

  if not exists (
    select 1 from public.contacts c
    where c.status = 'accepted'
      and ((c.requester = owner_id and c.addressee = auth.uid())
        or (c.requester = auth.uid() and c.addressee = owner_id))
  ) then
    raise exception 'this contact is blocked';
  end if;

  return owner_id;
end;
$$;

create or replace function public.block_contact(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_other_user_id is null or p_other_user_id = auth.uid() then
    raise exception 'invalid contact';
  end if;

  if exists (
    select 1 from public.contacts c
    where c.status = 'blocked'
      and c.blocked_by <> auth.uid()
      and ((c.requester = auth.uid() and c.addressee = p_other_user_id)
        or (c.requester = p_other_user_id and c.addressee = auth.uid()))
  ) then
    return true;
  end if;

  delete from public.contacts
  where (requester = auth.uid() and addressee = p_other_user_id)
     or (requester = p_other_user_id and addressee = auth.uid());

  insert into public.contacts (requester, addressee, status, blocked_by)
  values (auth.uid(), p_other_user_id, 'blocked', auth.uid());

  update public.call_invites
  set status = 'ended', updated_at = now()
  where status in ('ringing', 'accepted')
    and ((caller = auth.uid() and callee = p_other_user_id)
      or (caller = p_other_user_id and callee = auth.uid()));

  return true;
end;
$$;

create or replace function public.unblock_contact(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  delete from public.contacts
  where status = 'blocked'
    and blocked_by = auth.uid()
    and ((requester = auth.uid() and addressee = p_other_user_id)
      or (requester = p_other_user_id and addressee = auth.uid()));

  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

create or replace function public.rotate_contact_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  new_code := encode(extensions.gen_random_bytes(24), 'hex');
  update public.profiles
  set invite_code = new_code
  where id = auth.uid();

  if not found then
    raise exception 'profile not found';
  end if;

  return new_code;
end;
$$;

create or replace function private.guard_profile_invite_code()
returns trigger
language plpgsql
set search_path = ''
as $guard$
begin
  if new.invite_code is distinct from old.invite_code
    and current_user not in ('postgres', 'service_role') then
    raise exception 'invite codes can only be changed through the secure rotation function';
  end if;
  return new;
end;
$guard$;

drop trigger if exists profiles_invite_code_guard on public.profiles;
create trigger profiles_invite_code_guard
before update of invite_code on public.profiles
for each row execute function private.guard_profile_invite_code();

revoke all on function private.guard_profile_invite_code() from public, anon, authenticated;

create or replace function private.call_invite_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.caller is distinct from old.caller
    or new.callee is distinct from old.callee
    or new.kind is distinct from old.kind then
    raise exception 'call participants and kind are immutable';
  end if;

  if old.status not in ('ringing', 'accepted') then
    raise exception 'call is closed';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'ringing' and new.status in ('accepted', 'declined') then
      if auth.uid() <> old.callee then
        raise exception 'only the recipient can accept or decline';
      end if;
    elsif old.status = 'ringing' and new.status = 'cancelled' then
      if auth.uid() <> old.caller then
        raise exception 'only the caller can cancel';
      end if;
    elsif new.status = 'ended' then
      if auth.uid() not in (old.caller, old.callee) then
        raise exception 'only a call participant can end the call';
      end if;
    else
      raise exception 'invalid call status transition';
    end if;
  end if;

  if new.status = 'accepted' and private.is_blocked_pair(old.caller, old.callee) then
    raise exception 'blocked contacts cannot call';
  end if;

  if new.callee_peer_id is distinct from old.callee_peer_id then
    if auth.uid() <> old.callee or new.status <> 'accepted' then
      raise exception 'only the recipient can set the media peer id after accepting';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists call_invites_guard on public.call_invites;
create trigger call_invites_guard
before update on public.call_invites
for each row execute function private.call_invite_guard();

revoke all on function private.call_invite_guard() from public, anon, authenticated;

drop policy if exists calls_read on public.call_invites;
create policy calls_read on public.call_invites
  for select to authenticated
  using (auth.uid() in (caller, callee));

drop policy if exists calls_create on public.call_invites;
create policy calls_create on public.call_invites
  for insert to authenticated
  with check (
    auth.uid() = caller
    and caller <> callee
    and status = 'ringing'
    and callee_peer_id is null
    and public.are_contacts(caller, callee)
  );

drop policy if exists calls_update on public.call_invites;
create policy calls_update on public.call_invites
  for update to authenticated
  using (
    auth.uid() in (caller, callee)
    and status in ('ringing', 'accepted')
  )
  with check (
    auth.uid() in (caller, callee)
    and status in ('ringing', 'accepted', 'declined', 'cancelled', 'ended')
  );

grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update on public.call_invites to authenticated;
grant all on public.contacts, public.call_invites to service_role;

revoke all on function public.are_contacts(uuid, uuid) from public, anon;
revoke all on function public.search_directory(text) from public, anon;
revoke all on function public.contact_names(uuid[]) from public, anon;
revoke all on function public.redeem_invite(text) from public, anon;
revoke all on function public.block_contact(uuid) from public, anon;
revoke all on function public.unblock_contact(uuid) from public, anon;
revoke all on function public.rotate_contact_invite() from public, anon;

grant execute on function public.are_contacts(uuid, uuid) to authenticated;
grant execute on function public.search_directory(text) to authenticated;
grant execute on function public.contact_names(uuid[]) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.block_contact(uuid) to authenticated;
grant execute on function public.unblock_contact(uuid) to authenticated;
grant execute on function public.rotate_contact_invite() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_invites'
  ) then
    alter publication supabase_realtime add table public.call_invites;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end;
$$;
