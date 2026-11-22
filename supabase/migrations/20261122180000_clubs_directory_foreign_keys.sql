-- Ensure all persisted club data references a real directory record.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='club_memberships_club_id_fkey') then
    alter table public.club_memberships add constraint club_memberships_club_id_fkey foreign key(club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='club_events_club_id_fkey') then
    alter table public.club_events add constraint club_events_club_id_fkey foreign key(club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='club_messages_club_id_fkey') then
    alter table public.club_messages add constraint club_messages_club_id_fkey foreign key(club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='club_membership_activity_club_id_fkey') then
    alter table public.club_membership_activity add constraint club_membership_activity_club_id_fkey foreign key(club_id) references public.clubs(id) on delete restrict;
  end if;
end $$;
