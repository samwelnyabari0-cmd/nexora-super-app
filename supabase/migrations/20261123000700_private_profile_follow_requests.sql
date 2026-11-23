create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follow_requests_not_self check (requester_id <> target_id),
  constraint follow_requests_unique_pair unique (requester_id, target_id)
);
alter table public.follow_requests enable row level security;
drop policy if exists "Users can read relevant follow requests" on public.follow_requests;
create policy "Users can read relevant follow requests" on public.follow_requests
for select to authenticated using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));
grant select on public.follow_requests to authenticated;

create or replace function public.request_or_follow_profile(p_target_id uuid)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_user_id uuid := auth.uid(); v_private boolean; v_inserted integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_target_id is null or p_target_id = v_user_id then raise exception 'Invalid follow target'; end if;
  select coalesce(private_profile, false) into v_private from public.profiles where id = p_target_id;
  if not found then raise exception 'Profile not found'; end if;
  if exists (select 1 from public.follows where follower_id = v_user_id and following_id = p_target_id) then return 'following'; end if;
  if v_private then
    insert into public.follow_requests(requester_id, target_id) values (v_user_id, p_target_id)
    on conflict (requester_id, target_id) do nothing;
    insert into public.notifications(recipient_id, actor_id, kind, body)
    select p_target_id, v_user_id, 'follow_request', 'requested to follow you'
    where not exists (select 1 from public.notifications n where n.recipient_id = p_target_id and n.actor_id = v_user_id and n.kind = 'follow_request' and n.created_at > now() - interval '1 day');
    return 'requested';
  end if;
  insert into public.follows(follower_id, following_id) values (v_user_id, p_target_id)
  on conflict (follower_id, following_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then insert into public.notifications(recipient_id, actor_id, kind, body) values (p_target_id, v_user_id, 'follow', 'started following you'); end if;
  return 'following';
end;
$function$;

create or replace function public.get_my_follow_requests()
returns table(id uuid, requester_id uuid, display_name text, handle text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select r.id, r.requester_id, p.display_name, p.handle, p.avatar_url, r.created_at
  from public.follow_requests r join public.profiles p on p.id = r.requester_id
  where r.target_id = auth.uid() order by r.created_at desc limit 100;
$function$;

create or replace function public.approve_follow_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_request public.follow_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.follow_requests where id = p_request_id and target_id = auth.uid() for update;
  if not found then raise exception 'Follow request not found'; end if;
  insert into public.follows(follower_id, following_id) values (v_request.requester_id, v_request.target_id) on conflict (follower_id, following_id) do nothing;
  delete from public.follow_requests where id = p_request_id;
  insert into public.notifications(recipient_id, actor_id, kind, body) values (v_request.requester_id, v_request.target_id, 'follow', 'approved your follow request');
  return true;
end;
$function$;

create or replace function public.decline_follow_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_deleted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.follow_requests where id = p_request_id and target_id = auth.uid();
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

revoke all on function public.request_or_follow_profile(uuid) from public, anon;
revoke all on function public.get_my_follow_requests() from public, anon;
revoke all on function public.approve_follow_request(uuid) from public, anon;
revoke all on function public.decline_follow_request(uuid) from public, anon;
grant execute on function public.request_or_follow_profile(uuid) to authenticated;
grant execute on function public.get_my_follow_requests() to authenticated;
grant execute on function public.approve_follow_request(uuid) to authenticated;
grant execute on function public.decline_follow_request(uuid) to authenticated;


drop policy if exists "Requesters can cancel their requests" on public.follow_requests;
create policy "Requesters can cancel their requests" on public.follow_requests
for delete to authenticated using (requester_id = (select auth.uid()));
grant delete on public.follow_requests to authenticated;
