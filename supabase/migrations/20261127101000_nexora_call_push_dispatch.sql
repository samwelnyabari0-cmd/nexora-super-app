-- Send new call invitations to the recipient's registered browser push devices.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'nexora_call_push_webhook_secret',
  'Authentication secret for the NEXORA incoming call push webhook'
);

create or replace function public.dispatch_nexora_call_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_secret text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'nexora_call_push_webhook_secret'
  limit 1;

  if hook_secret is null then
    raise warning 'NEXORA call push webhook secret is not configured';
    return new;
  end if;

  perform net.http_post(
    url := 'https://samwelnyabari0-cmd-nexora-super-app.vercel.app/api/call-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nexora-call-secret', hook_secret
    ),
    body := jsonb_build_object(
      'callId', new.id,
      'callerId', new.caller,
      'calleeId', new.callee,
      'kind', new.kind
    ),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;

drop trigger if exists call_invites_push_notify on public.call_invites;
create trigger call_invites_push_notify
after insert on public.call_invites
for each row
when (new.status = 'ringing')
execute function public.dispatch_nexora_call_push();
