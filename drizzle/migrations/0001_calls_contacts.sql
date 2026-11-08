alter table public.profiles add column if not exists discoverable boolean not null default false;
alter table public.profiles add column if not exists invite_code text unique default substr(md5(gen_random_uuid()::text),1,10);
update public.profiles set invite_code = substr(md5(gen_random_uuid()::text),1,10) where invite_code is null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null,
  addressee uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy contacts_read on public.contacts for select to authenticated using (auth.uid() in (requester, addressee));
create policy contacts_request on public.contacts for insert to authenticated with check (auth.uid() = requester and status = 'pending');
create policy contacts_respond on public.contacts for update to authenticated using (auth.uid() = addressee) with check (auth.uid() = addressee);
create policy contacts_remove on public.contacts for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_contacts(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contacts where status='accepted'
    and ((requester=a and addressee=b) or (requester=b and addressee=a)))
$$;

create table public.call_invites (
  id uuid primary key default gen_random_uuid(),
  caller uuid not null,
  callee uuid not null,
  kind text not null check (kind in ('audio','video')),
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','cancelled','ended')),
  callee_peer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.call_invites to authenticated;
grant all on public.call_invites to service_role;
alter table public.call_invites enable row level security;
create policy calls_read on public.call_invites for select to authenticated using (auth.uid() in (caller, callee));
create policy calls_create on public.call_invites for insert to authenticated
  with check (auth.uid() = caller and status = 'ringing' and callee_peer_id is null and public.are_contacts(caller, callee));
create policy calls_update on public.call_invites for update to authenticated using (auth.uid() in (caller, callee)) with check (auth.uid() in (caller, callee));

create or replace function public.call_invite_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.caller <> old.caller or new.callee <> old.callee or new.kind <> old.kind then
    raise exception 'immutable fields';
  end if;
  if new.status = 'accepted' and (auth.uid() <> old.callee or old.status <> 'ringing') then
    raise exception 'only the recipient can accept a ringing call';
  end if;
  if new.status = 'declined' and auth.uid() <> old.callee then raise exception 'only the recipient can decline'; end if;
  if new.status = 'cancelled' and auth.uid() <> old.caller then raise exception 'only the caller can cancel'; end if;
  if new.callee_peer_id is distinct from old.callee_peer_id and auth.uid() <> old.callee then
    raise exception 'only the recipient sets the media id';
  end if;
  if old.status in ('declined','cancelled','ended') then raise exception 'call is closed'; end if;
  new.updated_at = now();
  return new;
end $$;
create trigger call_invites_guard before update on public.call_invites for each row execute function public.call_invite_guard();

create or replace function public.search_directory(q text)
returns table (id uuid, display_name text, handle text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.handle from public.profiles p
  where p.discoverable and p.id <> auth.uid() and auth.uid() is not null
    and length(trim(q)) >= 2
    and (p.display_name ilike '%'||q||'%' or p.handle ilike '%'||q||'%')
  limit 20
$$;

create or replace function public.contact_names(ids uuid[])
returns table (id uuid, display_name text, handle text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.handle from public.profiles p
  where p.id = any(ids) and exists (select 1 from public.contacts c
    where (c.requester=auth.uid() and c.addressee=p.id) or (c.addressee=auth.uid() and c.requester=p.id)
       or exists (select 1 from public.call_invites ci where auth.uid() in (ci.caller,ci.callee) and p.id in (ci.caller,ci.callee)))
$$;

create or replace function public.redeem_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  select id into owner from public.profiles where invite_code = code;
  if owner is null or owner = auth.uid() then raise exception 'invalid invite'; end if;
  insert into public.contacts (requester, addressee, status) values (owner, auth.uid(), 'accepted')
  on conflict (requester, addressee) do update set status = 'accepted';
  delete from public.contacts where requester = auth.uid() and addressee = owner and status <> 'accepted';
  return owner;
end $$;

revoke execute on function public.search_directory(text), public.contact_names(uuid[]), public.redeem_invite(text), public.are_contacts(uuid,uuid) from anon, public;
grant execute on function public.search_directory(text), public.contact_names(uuid[]), public.redeem_invite(text), public.are_contacts(uuid,uuid) to authenticated;

alter publication supabase_realtime add table public.call_invites;
alter publication supabase_realtime add table public.contacts;