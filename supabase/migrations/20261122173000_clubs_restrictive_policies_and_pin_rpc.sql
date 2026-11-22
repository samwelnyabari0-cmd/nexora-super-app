-- Convert broad suspension checks into restrictive policies, then expose a
-- narrowly scoped RPC for pinning channel messages.
do $$
declare t text;
begin
  foreach t in array array['club_memberships','club_events','club_messages','club_membership_activity','event_rsvps'] loop
    execute format('drop policy if exists suspended_accounts_block on public.%I',t);
    execute format('create policy suspended_accounts_block on public.%I as restrictive for all to authenticated using (not public.is_my_account_suspended()) with check (not public.is_my_account_suspended())',t);
  end loop;
end $$;

create or replace function public.set_club_message_pin(p_message_id uuid,p_pinned boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_club_id text;
begin
  select club_id into v_club_id from public.club_messages where id=p_message_id;
  if v_club_id is null then raise exception 'Club message not found'; end if;
  if not private.can_manage_club_events(v_club_id) then raise exception 'Club manager permission required'; end if;
  update public.club_messages set pinned_at=case when p_pinned then now() else null end where id=p_message_id;
end;
$$;
grant execute on function public.set_club_message_pin(uuid,boolean) to authenticated;
