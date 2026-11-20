import { useEffect, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidLocation, openStreetMapUrl, type ChatLocationPayload, type LocationShareStatus } from "./location-sharing";

type LocationShareCardProps = {
  oneTime?: ChatLocationPayload | null;
  sessionId?: string | null;
  topic?: string;
};

type LocationSessionRow = {
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  last_updated_at: string;
  status: LocationShareStatus;
};

const STATUS_LABEL: Record<LocationShareStatus, string> = {
  live: "Live",
  stale: "Last update is stale",
  stopped: "Sharing stopped",
  expired: "Sharing expired",
};

export function LocationShareCard({ oneTime, sessionId, topic }: LocationShareCardProps) {
  const [session, setSession] = useState<LocationSessionRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_chat_location_share",
        { p_session_id: sessionId },
      );
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setFailed(true);
        setSession(null);
        return;
      }
      setFailed(false);
      setSession(row as LocationSessionRow);
    };
    void load();

    let channel: any = null;
    if (topic) {
      channel = supabase.channel(topic, { config: { private: true } })
        .on("broadcast", { event: "location_updated" }, (event) => {
          if (event.payload?.session_id === sessionId) void load();
        })
        .subscribe();
    }
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [sessionId, topic]);

  const latitude = oneTime?.latitude ?? session?.latitude ?? null;
  const longitude = oneTime?.longitude ?? session?.longitude ?? null;
  const hasCoordinates = latitude !== null && longitude !== null
    && isValidLocation(latitude, longitude);
  const mapUrl = hasCoordinates ? openStreetMapUrl(latitude, longitude) : null;
  const status = oneTime ? "Shared once" : session ? STATUS_LABEL[session.status] : failed ? "Unavailable" : "Loading";
  const updatedAt = oneTime?.capturedAt ?? session?.last_updated_at ?? null;
  const accuracy = oneTime?.accuracyM ?? session?.accuracy_m ?? null;

  return (
    <div className="mb-2 flex max-w-sm items-center gap-3 rounded-xl border border-current/10 bg-background/40 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {sessionId ? <Radio className="h-5 w-5" aria-hidden /> : <MapPin className="h-5 w-5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{sessionId ? "Live location" : "Shared location"}</span>
        <span className="block text-xs text-muted-foreground">
          {status}{updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        {accuracy !== null && <span className="block text-[11px] text-muted-foreground">Accuracy about {Math.round(accuracy)} m</span>}
        {!hasCoordinates && sessionId && (session?.status === "stopped" || session?.status === "expired") && (
          <span className="block text-[11px] text-muted-foreground">The location point is no longer available.</span>
        )}
      </span>
      {mapUrl ? (
        <a href={mapUrl} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10">
          Open map
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">{failed ? "Unavailable" : "No map"}</span>
      )}
    </div>
  );
}
