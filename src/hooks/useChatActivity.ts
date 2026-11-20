import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatActivityKind = "typing" | "recording";

type ChatActivity = {
  user_id: string;
  activity: ChatActivityKind;
  updated_at: string;
};

type UseChatActivityOptions = {
  topic: string;
  userId: string;
  enabled?: boolean;
};

export function useChatActivity({
  topic,
  userId,
  enabled = true,
}: UseChatActivityOptions) {
  const [remoteActivity, setRemoteActivity] = useState<ChatActivity[]>([]);
  const channelRef = useRef<any>(null);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !userId || !topic) {
      setRemoteActivity([]);
      return;
    }

    let active = true;
    const channel = supabase.channel(topic, {
      config: {
        private: true,
        presence: { key: userId },
      },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      if (!active) return;
      const state = channel.presenceState() as Record<string, ChatActivity[]>;
      const entries = Object.values(state).flat();
      setRemoteActivity(entries.filter((entry) =>
        entry && entry.user_id !== userId &&
        (entry.activity === "typing" || entry.activity === "recording")
      ));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe();

    return () => {
      active = false;
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      channelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
      setRemoteActivity([]);
    };
  }, [enabled, topic, userId]);

  const publishActivity = useCallback((activity: ChatActivityKind | null) => {
    const channel = channelRef.current;
    if (!channel) return;

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!activity) {
      void channel.untrack();
      return;
    }

    void channel.track({
      user_id: userId,
      activity,
      updated_at: new Date().toISOString(),
    });

    if (activity === "typing") {
      idleTimerRef.current = window.setTimeout(() => {
        void channel.untrack();
        idleTimerRef.current = null;
      }, 3000);
    }
  }, [userId]);

  return { remoteActivity, publishActivity };
}
