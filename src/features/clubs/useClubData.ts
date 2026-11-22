import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { aggregateClubRsvps, type ClubRsvpStatus, type ClubRsvpCounts } from "./logic";

export type ClubDirectoryItem = {
  id: string;
  name: string;
  kind: "football" | "gaming" | "tech";
  city: string;
  venue: string;
  blurb: string;
  latitude: number | null;
  longitude: number | null;
  active_member_count: number;
};

export type ClubEvent = {
  id: string;
  club_id: string;
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  kind: string;
  notes: string;
};


export function useClubData(clubId: string) {
  const { user, ready } = useSession();
  const [directory, setDirectory] = useState<ClubDirectoryItem[]>([]);
  const [membership, setMembership] = useState<{ role: string; status: string } | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [myRsvps, setMyRsvps] = useState<Record<string, ClubRsvpStatus>>({});
  const [rsvpCounts, setRsvpCounts] = useState<ClubRsvpCounts>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadCounts({});
      return;
    }
    const { data, error: unreadError } = await (supabase.rpc("get_club_unread_counts" as never) as any);
    if (unreadError) return;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.club_id] = Number(row.unread_count ?? 0);
    setUnreadCounts(counts);
  }, [user]);

  const refreshDirectory = useCallback(async () => {
    const { data, error: directoryError } = await (supabase.rpc("get_club_directory" as never) as any);
    if (directoryError) {
      setError("Unable to load the club directory.");
      return;
    }
    setDirectory((data ?? []) as ClubDirectoryItem[]);
    await refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  const refreshClub = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [membershipResult, eventsResult] = await Promise.all([
      user
        ? (supabase.from("club_memberships" as never) as any)
            .select("role,status").eq("club_id", clubId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      (supabase.from("club_events" as never) as any)
        .select("id,club_id,title,venue,event_date,event_time,kind,notes")
        .eq("club_id", clubId)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true }),
    ]);

    if (membershipResult.error) setError("Unable to load your club membership.");
    setMembership(membershipResult.data ?? null);

    if (eventsResult.error) {
      setError("Unable to load club fixtures and events.");
      setEvents([]);
      setMyRsvps({});
      setRsvpCounts({});
      setLoading(false);
      return;
    }

    const rows = (eventsResult.data ?? []) as ClubEvent[];
    setEvents(rows);
    const eventIds = rows.map((event) => event.id);

    if (!user || membershipResult.data?.status !== "active" || !eventIds.length) {
      setMyRsvps({});
      setRsvpCounts({});
      setLoading(false);
      return;
    }

    const { data: rsvpData, error: rsvpError } = await (supabase.from("event_rsvps" as never) as any)
      .select("event_id,user_id,status")
      .in("event_id", eventIds);

    if (rsvpError) {
      setError("Unable to load event responses.");
      setMyRsvps({});
      setRsvpCounts({});
    } else {
      const aggregated = aggregateClubRsvps(rsvpData ?? [], user.id);
      setMyRsvps(aggregated.myRsvps);
      setRsvpCounts(aggregated.counts);
    }
    setLoading(false);
  }, [clubId, user]);

  useEffect(() => {
    if (!ready) return;
    void refreshDirectory();
    void refreshClub();
  }, [ready, refreshDirectory, refreshClub]);

  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`club-data-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_memberships", filter: `club_id=eq.${clubId}` }, () => {
        void refreshDirectory();
        void refreshClub();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "club_events", filter: `club_id=eq.${clubId}` }, () => void refreshClub())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, () => void refreshClub())
      .on("postgres_changes", { event: "*", schema: "public", table: "club_messages" }, () => void refreshUnreadCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "club_channel_reads", filter: `club_id=eq.${clubId}` }, () => void refreshUnreadCounts())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clubId, ready, refreshDirectory, refreshClub, refreshUnreadCounts]);

  const requestMembership = useCallback(async () => {
    if (!user) return { error: "Sign in to join a club." };
    if (membership?.status === "banned") return { error: "You cannot rejoin this club." };
    if (membership) return { error: membership.status === "pending" ? "Your request is awaiting approval." : "You are already a member." };
    const { error: insertError } = await (supabase.from("club_memberships" as never) as any).insert({
      club_id: clubId, user_id: user.id, role: "member", status: "pending",
    });
    if (insertError) return { error: insertError.message };
    await refreshDirectory();
    await refreshClub();
    return { error: null };
  }, [clubId, membership, refreshClub, refreshDirectory, user]);

  const leaveClub = useCallback(async () => {
    if (!user) return { error: "Sign in to manage your membership." };
    if (!membership || membership.role === "creator") return { error: "The club creator must transfer ownership before leaving." };
    const { error: deleteError } = await (supabase.from("club_memberships" as never) as any)
      .delete().eq("club_id", clubId).eq("user_id", user.id);
    if (deleteError) return { error: deleteError.message };
    await refreshDirectory();
    await refreshClub();
    return { error: null };
  }, [clubId, membership, refreshClub, refreshDirectory, user]);

  const createEvent = useCallback(async (event: Omit<ClubEvent, "id" | "club_id">) => {
    if (!user || membership?.status !== "active" || !["creator", "admin", "moderator"].includes(membership.role)) {
      return { error: "You do not have permission to create club events." };
    }
    const { error: insertError } = await (supabase.from("club_events" as never) as any).insert({
      club_id: clubId, title: event.title, venue: event.venue,
      event_date: event.event_date, event_time: event.event_time,
      kind: event.kind, notes: event.notes, created_by: user.id,
    });
    if (insertError) return { error: insertError.message };
    await refreshClub();
    return { error: null };
  }, [clubId, membership, refreshClub, user]);

  const setRsvp = useCallback(async (eventId: string, status: ClubRsvpStatus | null) => {
    if (!user || membership?.status !== "active") return { error: "Join the club before responding to an event." };
    const query = supabase.from("event_rsvps" as never) as any;
    const result = status
      ? await query.upsert({ event_id: eventId, user_id: user.id, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,user_id" })
      : await query.delete().eq("event_id", eventId).eq("user_id", user.id);
    if (result.error) return { error: result.error.message };
    await refreshClub();
    return { error: null };
  }, [membership?.status, refreshClub, user]);

  return {
    directory, membership, events, myRsvps, rsvpCounts, unreadCounts, loading, error,
    refreshDirectory, refreshClub, requestMembership, leaveClub, setRsvp, createEvent,
    authenticated: Boolean(user), userId: user?.id ?? null,
  };
}
