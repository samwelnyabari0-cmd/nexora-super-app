create policy "notifications_delete_self"
on public.notifications
for delete
to authenticated
using (auth.uid() = recipient_id);

create index if not exists notifications_recipient_read_at_idx
on public.notifications (recipient_id, read_at);

create index if not exists notifications_recipient_created_id_idx
on public.notifications (recipient_id, created_at desc, id desc);
