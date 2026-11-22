-- Allow any non-creator member to leave without changing their role.
drop policy if exists "Non-creators may leave clubs" on public.club_memberships;
create policy "Non-creators may leave clubs" on public.club_memberships
for delete to authenticated
using (user_id=(select auth.uid()) and role in ('member','moderator','admin'));

-- Suspended accounts cannot read or write event RSVPs.
drop policy if exists "Suspended accounts cannot use event RSVPs" on public.event_rsvps;
create policy "Suspended accounts cannot use event RSVPs" on public.event_rsvps
as restrictive for all to authenticated
using (not is_my_account_suspended())
with check (not is_my_account_suspended());
