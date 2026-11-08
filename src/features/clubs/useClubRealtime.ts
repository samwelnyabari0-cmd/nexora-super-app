import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export type ClubRealtimeMessage = {
  id: string;
  from: "me" | "club";
  text: string;
  at: string;
};

export function useClubRealtime(clubId: string) {
  const { user, ready } = useSession();
  const [messages, setMessages] = useState<ClubRealtimeMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: queryError } = await (supabase.from("club_messages" as never) as any)
      .select("id,sender_id,sender_name,body,created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (queryError) setError("Unable to load club messages.");
    else setMessages((data ?? []).map((item: any) => ({ id: item.id, from: item.sender_id === user.id ? "me" : "club", text: item.body, at: new Date(item.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) })));
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

  const send = useCallback(async (body: string, senderName: string) => {
    if (!user) {
      setError("Sign in to send a real club message.");
      return false;
    }
    const { error: insertError } = await (supabase.from("club_messages" as never) as any).insert({ club_id: clubId, sender_id: user.id, sender_name: senderName, body });
    if (insertError) {
      setError("Message delivery failed. Please try again.");
      return false;
    }
    return true;
  }, [clubId, user]);

  return { authenticated: Boolean(user), messages, send, error };
}
