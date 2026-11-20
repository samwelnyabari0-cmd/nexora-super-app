import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentLocation,
  shouldPublishLocation,
  type ChatLocationPayload,
} from "@/components/nexora/location-sharing";

type ChatKind = "direct" | "group";

type UseChatLocationSharingOptions = {
  chatKind: ChatKind;
  chatId: string;
  userId: string;
  enabled?: boolean;
  onShareOnce: (payload: ChatLocationPayload) => Promise<boolean>;
  onLiveSession: (sessionId: string) => Promise<boolean>;
};

export function useChatLocationSharing({
  chatKind,
  chatId,
  userId,
  enabled = true,
  onShareOnce,
  onLiveSession,
}: UseChatLocationSharingOptions) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const channelRef = useRef<any>(null);
  const sessionRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastPublishedAtRef = useRef(0);
  const busyRef = useRef(false);
  const topic = chatKind === "group"
    ? `group:${chatId}`
    : `dm:${[userId, chatId].sort().join(":")}`;

  const broadcastChange = useCallback((sessionId: string) => {
    const channel = channelRef.current;
    if (channel) {
      void channel.send({
        type: "broadcast",
        event: "location_updated",
        payload: { session_id: sessionId },
      });
    }
  }, []);

  const clearTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (expiryTimerRef.current !== null) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const stopLiveSharing = useCallback(async () => {
    const sessionId = sessionRef.current;
    clearTracking();
    if (!sessionId) return;
    sessionRef.current = null;
    setActiveSessionId(null);
    const { error: stopError } = await (supabase as any).rpc(
      "stop_chat_location_share",
      { p_session_id: sessionId },
    );
    if (stopError) {
      setError("Live location could not be stopped on the server. It will still expire automatically.");
      return;
    }
    broadcastChange(sessionId);
  }, [broadcastChange, clearTracking]);

  const shareOnce = useCallback(async () => {
    if (!enabled || !userId || !chatId || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = await getCurrentLocation();
      const sent = await onShareOnce(payload);
      if (!sent) throw new Error("Your location message could not be sent.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your location could not be shared.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [chatId, enabled, onShareOnce, userId]);

  const startLiveSharing = useCallback(async (durationMinutes: 15 | 60) => {
    if (!enabled || !userId || !chatId || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (sessionRef.current) await stopLiveSharing();
      const initial = await getCurrentLocation();
      const { data, error: startError } = await (supabase as any).rpc(
        "start_chat_location_share",
        {
          p_chat_kind: chatKind,
          p_recipient_id: chatKind === "direct" ? chatId : null,
          p_group_id: chatKind === "group" ? chatId : null,
          p_duration_minutes: durationMinutes,
          p_latitude: initial.latitude,
          p_longitude: initial.longitude,
          p_accuracy_m: initial.accuracyM,
        },
      );
      if (startError || typeof data !== "string") {
        throw new Error(startError?.message || "Live location could not be started.");
      }
      const sessionId = data as string;
      sessionRef.current = sessionId;
      setActiveSessionId(sessionId);
      lastPublishedAtRef.current = Date.now();

      let messageSent = false;
      try {
        messageSent = await onLiveSession(sessionId);
      } catch {
        await stopLiveSharing();
        throw new Error("The live location card could not be sent.");
      }
      if (!messageSent) {
        await stopLiveSharing();
        throw new Error("The live location card could not be sent.");
      }

      if (!navigator.geolocation) {
        await stopLiveSharing();
        throw new Error("Location is not supported by this browser.");
      }

      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          if (!shouldPublishLocation(lastPublishedAtRef.current, now)) return;
          const currentSessionId = sessionRef.current;
          if (!currentSessionId) return;
          lastPublishedAtRef.current = now;
          const { error: updateError } = await (supabase as any).rpc(
            "update_chat_location_share",
            {
              p_session_id: currentSessionId,
              p_latitude: position.coords.latitude,
              p_longitude: position.coords.longitude,
              p_accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            },
          );
          if (updateError) {
            setError("Live location updates stopped because the latest position could not sync.");
            await stopLiveSharing();
            return;
          }
          broadcastChange(currentSessionId);
        },
        async (positionError) => {
          setError(positionError.code === 1
            ? "Location permission was revoked. Live sharing has stopped."
            : "Your location could not update. Live sharing has stopped.");
          await stopLiveSharing();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
        );
      } catch {
        await stopLiveSharing();
        throw new Error("Live location tracking could not start.");
      }
      expiryTimerRef.current = window.setTimeout(() => {
        void stopLiveSharing();
      }, durationMinutes * 60_000);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Live location could not be started.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [broadcastChange, chatId, chatKind, enabled, onLiveSession, stopLiveSharing, userId]);

  const chatIdentityRef = useRef(`${chatKind}:${chatId}:${userId}`);
  useEffect(() => {
    const nextIdentity = `${chatKind}:${chatId}:${userId}`;
    if (chatIdentityRef.current !== nextIdentity || !enabled) {
      chatIdentityRef.current = nextIdentity;
      if (sessionRef.current) void stopLiveSharing();
      else setActiveSessionId(null);
    }
  }, [chatId, chatKind, enabled, stopLiveSharing, userId]);

  useEffect(() => {
    if (!enabled || !chatId || !userId) return;
    const channel = supabase.channel(topic, { config: { private: true } });
    channelRef.current = channel;
    channel.subscribe();
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [chatId, enabled, topic, userId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const stopWhenHidden = () => {
      if (document.visibilityState === "hidden") void stopLiveSharing();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => document.removeEventListener("visibilitychange", stopWhenHidden);
  }, [activeSessionId, stopLiveSharing]);

  useEffect(() => () => {
    const sessionId = sessionRef.current;
    clearTracking();
    sessionRef.current = null;
    if (sessionId) {
      void (supabase as any).rpc("stop_chat_location_share", { p_session_id: sessionId });
    }
  }, [clearTracking]);

  return {
    activeSessionId,
    busy,
    error,
    shareOnce,
    startLiveSharing,
    stopLiveSharing,
    clearError: () => setError(""),
  };
}
