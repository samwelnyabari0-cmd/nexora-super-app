create policy "notifications_delete_self"
on public.notifications
for delete
to authenticated
using (auth.uid() = recipient_id);
