-- Tighten privileges for trigger-only functions and improve FK/RLS query plans.
-- User-facing SECURITY DEFINER RPCs remain available to authenticated users and
-- enforce their own participant, ownership, and expiry checks.

drop policy if exists chat_message_settings_participants_select
  on public.chat_message_settings;

create policy chat_message_settings_participants_select
on public.chat_message_settings
for select to authenticated
using (
  (chat_kind = 'direct' and ((select auth.uid()) = user_a_id or (select auth.uid()) = user_b_id))
  or (chat_kind = 'group' and private.is_group_member(group_id))
);

-- Trigger functions are invoked by their table triggers, not through PostgREST RPC.
revoke all on function public.apply_chat_message_expiry()
  from public, anon, authenticated;
revoke all on function public.validate_chat_location_message()
  from public, anon, authenticated;
revoke all on function public.validate_shared_message_content()
  from public, anon, authenticated;
revoke all on function public.keep_chat_message_expiry_immutable()
  from public, anon, authenticated;

-- Cover foreign keys used for participant cleanup and membership lookups.
create index if not exists direct_message_reactions_user_idx
  on public.direct_message_reactions(user_id);
create index if not exists chat_group_message_reactions_user_idx
  on public.chat_group_message_reactions(user_id);
create index if not exists chat_location_shares_recipient_idx
  on public.chat_location_shares(recipient_id)
  where recipient_id is not null;
create index if not exists chat_message_settings_group_idx
  on public.chat_message_settings(group_id)
  where group_id is not null;
create index if not exists chat_message_settings_updated_by_idx
  on public.chat_message_settings(updated_by);
create index if not exists chat_message_settings_user_a_idx
  on public.chat_message_settings(user_a_id)
  where user_a_id is not null;
create index if not exists chat_message_settings_user_b_idx
  on public.chat_message_settings(user_b_id)
  where user_b_id is not null;
