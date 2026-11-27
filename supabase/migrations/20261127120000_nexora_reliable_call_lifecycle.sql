-- NEXORA reliable direct-call lifecycle (existing PeerJS + Supabase Realtime stack).
drop trigger if exists call_invites_guard on public.call_invites;

alter table public.call_invites
  add column if not exists ring_expires_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists end_reason text;
update public.call_invites
set ring_expires_at = coalesce(ring_expires_at, created_at + interval '40 seconds')
where ring_expires_at is null;
alter table public.call_invites
  alter column ring_expires_at set default (now() + interval '40 seconds'),
  alter column ring_expires_at set not null;
alter table public.call_invites drop constraint if exists call_invites_status_check;
alter table public.call_invites add constraint call_invites_status_check
  check (status in ('ringing','accepted','busy','missed','declined','cancelled','ended','failed'));
create index if not exists call_invites_active_ring_idx on public.call_invites(ring_expires_at) where status='ringing';
create index if not exists call_invites_active_participants_idx on public.call_invites(caller,callee,status,updated_at desc);

create or replace function private.expire_call_invites()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer:=0; v_rows integer:=0;
begin
  update public.call_invites set status='missed',ended_at=now(),end_reason='timeout'
  where status='ringing' and ring_expires_at<=now();
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  update public.call_invites set status='ended',ended_at=now(),end_reason='stale_session'
  where status='accepted' and updated_at<=now()-interval '2 hours';
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  return v_count;
end $$;

create or replace function private.lock_call_users(a uuid,b uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid;
begin
  if auth.uid() is null or auth.uid() not in (a,b) or a is null or b is null or a=b then raise exception 'not authorized'; end if;
  for v_user in select x from unnest(array[a,b]) as t(x) order by x loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nexora-call-user:'||v_user::text,0));
  end loop;
end $$;

create or replace function private.call_invite_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at
    or new.caller is distinct from old.caller or new.callee is distinct from old.callee
    or new.kind is distinct from old.kind then raise exception 'call identity, participants and kind are immutable'; end if;
  if old.status not in ('ringing','accepted') then raise exception 'call is closed'; end if;
  if new.status is distinct from old.status then
    if old.status='ringing' and new.status in ('accepted','declined') then
      if auth.uid()<>old.callee then raise exception 'only the recipient can accept or decline'; end if;
    elsif old.status='ringing' and new.status='cancelled' then
      if auth.uid()<>old.caller then raise exception 'only the caller can cancel'; end if;
    elsif new.status='missed' then
      if old.status<>'ringing' or old.ring_expires_at>now() then raise exception 'call has not expired'; end if;
    elsif new.status='ended' then
      if auth.uid() not in (old.caller,old.callee)
        and not (old.status='accepted' and old.updated_at<=now()-interval '2 hours') then
        raise exception 'only a participant can end this call';
      end if;
    else raise exception 'invalid call status transition';
    end if;
  end if;
  if new.status='accepted' then
    if private.is_blocked_pair(old.caller,old.callee) or not private.are_contacts(old.caller,old.callee) then
      raise exception 'only accepted, unblocked contacts can accept calls';
    end if;
    if new.callee_peer_id is null or length(trim(new.callee_peer_id))=0 or length(new.callee_peer_id)>255 then
      raise exception 'accepted calls require a valid recipient media peer id';
    end if;
    if old.ring_expires_at<=now() then raise exception 'call invitation has expired'; end if;
  end if;
  if old.callee_peer_id is not null and new.callee_peer_id is distinct from old.callee_peer_id then
    raise exception 'recipient media peer id cannot be changed once set';
  end if;
  if new.callee_peer_id is distinct from old.callee_peer_id and (auth.uid()<>old.callee or new.status<>'accepted') then
    raise exception 'only the recipient can set the media peer id after accepting';
  end if;
  if new.status in ('missed','declined','cancelled','ended','failed') then new.ended_at:=coalesce(new.ended_at,now()); end if;
  new.updated_at:=now(); return new;
end $$;
create trigger call_invites_guard before update on public.call_invites for each row execute function private.call_invite_guard();

create or replace function private.can_start_call(a uuid,b uuid)
returns boolean language plpgsql volatile security definer set search_path=''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from a or a is null or b is null or a=b then return false; end if;
  perform private.lock_call_users(a,b);
  perform private.lock_contact_pair(a,b);
  perform private.expire_call_invites();
  return not private.is_blocked_pair(a,b)
    and exists(select 1 from public.contacts c where c.status='accepted'
      and ((c.requester=a and c.addressee=b) or (c.requester=b and c.addressee=a)))
    and not exists(select 1 from public.call_invites ci where ci.status in ('ringing','accepted')
      and (ci.caller in (a,b) or ci.callee in (a,b)));
end $$;

create or replace function private.start_call(p_callee_id uuid,p_kind text)
returns public.call_invites language plpgsql security definer set search_path=''
as $$
declare v_caller_id uuid:=auth.uid(); v_call public.call_invites; v_busy boolean;
begin
  if v_caller_id is null then raise exception 'sign in required'; end if;
  if p_callee_id is null or p_callee_id=v_caller_id then raise exception 'invalid recipient'; end if;
  if p_kind not in ('audio','video') then raise exception 'invalid call type'; end if;
  perform private.lock_call_users(v_caller_id,p_callee_id);
  perform private.lock_contact_pair(v_caller_id,p_callee_id);
  perform private.expire_call_invites();
  if private.is_blocked_pair(v_caller_id,p_callee_id) or not exists(
    select 1 from public.contacts c where c.status='accepted'
    and ((c.requester=v_caller_id and c.addressee=p_callee_id) or (c.requester=p_callee_id and c.addressee=v_caller_id))
  ) then raise exception 'calls require an accepted, unblocked contact'; end if;
  select exists(select 1 from public.call_invites ci where ci.status in ('ringing','accepted')
    and (ci.caller in (v_caller_id,p_callee_id) or ci.callee in (v_caller_id,p_callee_id))) into v_busy;
  if v_busy then
    insert into public.call_invites(caller,callee,kind,status,ring_expires_at,ended_at,end_reason)
    values(v_caller_id,p_callee_id,p_kind,'busy',now(),now(),'busy') returning * into v_call;
  else
    insert into public.call_invites(caller,callee,kind,status,ring_expires_at)
    values(v_caller_id,p_callee_id,p_kind,'ringing',now()+interval '40 seconds') returning * into v_call;
  end if;
  return v_call;
end $$;

create or replace function private.respond_to_call(p_call_id uuid,p_action text,p_peer_id text default null)
returns public.call_invites language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_call public.call_invites;
begin
  if v_user_id is null then raise exception 'sign in required'; end if;
  select * into v_call from public.call_invites where id=p_call_id for update;
  if not found then raise exception 'call not found'; end if;
  if v_call.callee<>v_user_id then raise exception 'only the recipient can respond'; end if;
  if v_call.status<>'ringing' then return v_call; end if;
  if v_call.ring_expires_at<=now() then
    update public.call_invites set status='missed',ended_at=now(),end_reason='timeout' where id=p_call_id returning * into v_call;
    return v_call;
  end if;
  if p_action='decline' then
    update public.call_invites set status='declined',ended_at=now(),end_reason='declined' where id=p_call_id returning * into v_call;
  elsif p_action='accept' then
    if p_peer_id is null or length(trim(p_peer_id))=0 or length(p_peer_id)>255 then raise exception 'valid media peer id required'; end if;
    update public.call_invites set status='accepted',callee_peer_id=trim(p_peer_id) where id=p_call_id returning * into v_call;
  else raise exception 'invalid call action'; end if;
  return v_call;
end $$;

create or replace function private.end_call(p_call_id uuid)
returns public.call_invites language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_call public.call_invites; v_status text; v_reason text;
begin
  if v_user_id is null then raise exception 'sign in required'; end if;
  select * into v_call from public.call_invites where id=p_call_id for update;
  if not found then raise exception 'call not found'; end if;
  if v_user_id not in (v_call.caller,v_call.callee) then raise exception 'not a call participant'; end if;
  if v_call.status not in ('ringing','accepted') then return v_call; end if;
  if v_call.status='ringing' then
    if v_user_id=v_call.caller then v_status:='cancelled'; v_reason:='caller_cancel';
    else v_status:='declined'; v_reason:='declined'; end if;
  else v_status:='ended'; v_reason:='completed'; end if;
  update public.call_invites set status=v_status,ended_at=now(),end_reason=v_reason where id=p_call_id returning * into v_call;
  return v_call;
end $$;

create or replace function public.start_call(p_callee_id uuid,p_kind text)
returns public.call_invites language sql volatile security invoker set search_path=''
as $$ select private.start_call(p_callee_id,p_kind); $$;
create or replace function public.respond_to_call(p_call_id uuid,p_action text,p_peer_id text default null)
returns public.call_invites language sql volatile security invoker set search_path=''
as $$ select private.respond_to_call(p_call_id,p_action,p_peer_id); $$;
create or replace function public.end_call(p_call_id uuid)
returns public.call_invites language sql volatile security invoker set search_path=''
as $$ select private.end_call(p_call_id); $$;
create or replace function public.expire_call_invites()
returns integer language sql volatile security invoker set search_path=''
as $$ select private.expire_call_invites(); $$;

revoke all on function private.expire_call_invites() from public,anon;
revoke all on function private.lock_call_users(uuid,uuid) from public,anon;
revoke all on function private.can_start_call(uuid,uuid) from public,anon;
revoke all on function private.start_call(uuid,text) from public,anon;
revoke all on function private.respond_to_call(uuid,text,text) from public,anon;
revoke all on function private.end_call(uuid) from public,anon;
revoke all on function public.start_call(uuid,text) from public,anon;
revoke all on function public.respond_to_call(uuid,text,text) from public,anon;
revoke all on function public.end_call(uuid) from public,anon;
revoke all on function public.expire_call_invites() from public,anon;
grant execute on function private.start_call(uuid,text),private.respond_to_call(uuid,text,text),private.end_call(uuid),private.expire_call_invites() to authenticated;
grant execute on function public.start_call(uuid,text),public.respond_to_call(uuid,text,text),public.end_call(uuid),public.expire_call_invites() to authenticated;

alter table public.call_invites replica identity full;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_invites') then
    alter publication supabase_realtime add table public.call_invites;
  end if;
end $$;
do $$ begin
  if exists(select 1 from cron.job where jobname='nexora-expire-call-invites') then
    perform cron.unschedule(jobid) from cron.job where jobname='nexora-expire-call-invites';
  end if;
  perform cron.schedule('nexora-expire-call-invites','* * * * *','select private.expire_call_invites();');
end $$;
select private.expire_call_invites();
