import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export type ClubRealtimeMessage = {
  id: string;
  from: "me" | "club";
  text: string;
  at: string;
  senderName: string;
  role: string;
  isAnnouncement: boolean;
  pinnedAt: string | null;
};

export function useClubRealtime(clubId: string) {
  const { user, ready } = useSession();
  const [messages, setMessages] = useState<ClubRealtimeMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: queryError } = await (supabase.from("club_messages" as never) as any)
      .select("id,sender_id,sender_name,body,created_at,is_announcement,pinned_at")
      .eq("club_id", clubId)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(100);
    if (queryError) {
      setError("Unable to load club messages.");
    } else {
      const senderIds = [...new Set((data ?? []).map((item: any) => item.sender_id))];
      const { data: roles } = senderIds.length
        ? await (supabase.from("club_memberships" as never) as any)
            .select("user_id,role,status").eq("club_id", clubId).in("user_id", senderIds)
        : { data: [] };
      const roleByUser = new Map((roles ?? []).map((item: any) => [item.user_id, item.role]));
      const { data: myMembership } = await (supabase.from("club_memberships" as never) as any)
        .select("status").eq("club_id", clubId).eq("user_id", user.id).maybeSingle();
      if (myMembership?.status === "active") {
        await (supabase.rpc("mark_club_channel_read" as never, { p_club_id: clubId } as never) as any);
      }
      setMessages((data ?? []).map((item: any) => ({
        id: item.id,
        from: item.sender_id === user.id ? "me" : "club",
        text: item.body,
        senderName: item.sender_name,
        role: roleByUser.get(item.sender_id) ?? "member",
        isAnnouncement: Boolean(item.is_announcement),
        pinnedAt: item.pinned_at ?? null,
        at: new Date(item.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      })));
    }
  }, [clubId, user]);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
    const channel = supabase
      .channel(`club-messages-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_messages", filter: `club_id=eq.${clubId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clubId, load, ready, user]);

  const send = useCallback(async (body: string, isAnnouncement = false) => {
    if (!user) {
      setError("Sign in to send a real club message.");
      return false;
    }
    const { error: insertError } = await (supabase.from("club_messages" as never) as any).insert({ club_id: clubId, sender_id: user.id, body, is_announcement: isAnnouncement });
    if (insertError) {
      setError("Message delivery failed. Please try again.");
      return false;
    }
    return true;
  }, [clubId, user]);

  const pinMessage = useCallback(async (messageId: string, pinned: boolean) => {
    const { error: pinError } = await (supabase.rpc("set_club_message_pin" as never, { p_message_id: messageId, p_pinned: pinned } as never) as any);
    if (pinError) {
      setError("Could not update the pinned message.");
      return false;
    }
    await load();
    return true;
  }, [load]);

  return { authenticated: Boolean(user), messages, send, pinMessage, error };
}
