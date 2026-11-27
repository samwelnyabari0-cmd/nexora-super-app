-- Stale unanswered ringing invitations must not block a later call.
-- Accepted calls remain exclusive until one participant ends them.
create or replace function private.can_start_call(a uuid, b uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $start$
begin
  if auth.uid() is null or auth.uid() is distinct from a
    or a is null or b is null or a = b then
    return false;
  end if;

  perform private.lock_contact_pair(a, b);

  return not private.is_blocked_pair(a, b)
    and exists (
      select 1 from public.contacts c
      where c.status = 'accepted'
        and ((c.requester = a and c.addressee = b)
          or (c.requester = b and c.addressee = a))
    )
    and not exists (
      select 1 from public.call_invites ci
      where (
        ci.status = 'accepted'
        or (ci.status = 'ringing' and ci.created_at > now() - interval '75 seconds')
      )
        and (ci.caller in (a, b) or ci.callee in (a, b))
    );
end;
$start$;

grant execute on function private.can_start_call(uuid, uuid) to authenticated;
revoke all on function private.can_start_call(uuid, uuid) from anon, public;
