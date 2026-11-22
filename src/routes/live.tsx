import Peer from "peerjs";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Radio, Users, Square, MapPin, MapPinOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "LIVE — NEXORA" },
      { name: "description", content: "Watch and host real-time NEXORA live video streams." },
    ],
  }),
  component: LivePage,
});

const input = "w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm";

function LivePage() {
  async function stopLocationSharing() {
    if (locationWatchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }
    setLocationEnabled(false);
    if (hostSessionId) {
      const { error } = await (supabase as any).from("live_session_locations").delete().eq("session_id", hostSessionId);
      if (error) toast.error("Location sharing stopped, but the saved location could not be cleared.");
    }
  }

  function toggleLocationSharing() {
    if (locationEnabled) { void stopLocationSharing(); return; }
    if (!hostSessionId) { toast.error("Start a live stream before sharing your location."); return; }
    if (!navigator.geolocation) { toast.error("Location is not supported by this browser."); return; }
    locationWatchId.current = navigator.geolocation.watchPosition(async (position) => {
      const { error } = await (supabase as any).from("live_session_locations").upsert({
        session_id: hostSessionId, host_user_id: user?.id,
        latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      if (error) { console.error(error); toast.error("Could not share your live location."); void stopLocationSharing(); }
    }, (error) => {
      console.error(error); toast.error("Location permission was denied or your location is unavailable.");
      void stopLocationSharing();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    setLocationEnabled(true);
    toast.success("Live location is ON for approved viewers only.");
  }

  async function requestLocationAccess() {
    if (!watchingSessionId || !user) { toast.error("Sign in to request location access."); return; }
    const session = sessions.find((item) => item.id === watchingSessionId);
    if (!session) return;
    const { error } = await (supabase as any).from("live_location_access").insert({
      session_id: watchingSessionId, host_user_id: session.host_user_id,
      viewer_user_id: user.id, status: "pending",
    });
    if (error) { console.error(error); toast.error("Could not send your location-access request."); return; }
    setLocationRequestStatus("pending");
    toast.success("Request sent to the host.");
  }

  async function decideLocationAccess(requestId: string, decision: "approved" | "denied") {
    const { error } = await (supabase as any).from("live_location_access")
      .update({ status: decision, decided_at: new Date().toISOString() }).eq("id", requestId);
    if (error) { toast.error("Could not update location access."); return; }
    setLocationRequests((current) => current.map((item) => item.id === requestId ? { ...item, status: decision } : item));
    toast.success(decision === "approved" ? "Viewer approved for live location." : "Request declined.");
  }

  return (
    <div className="space-y-4">
      <PageHeader title="LIVE" subtitle="Watch a live broadcast or start your own stream" />
      <GoLive />
    </div>
  );
}

type LiveSessionRow = {
  id: string;
  host_user_id: string;
  title: string;
  peer_id: string;
  created_at: string;
  last_seen_at: string;
};

type LiveSignal = {
  type: "offer" | "answer" | "candidate" | "leave";
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit;
};

const LIVE_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function GoLive() {
  const { user } = useSession();

  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);

  const peerRef = useRef<Peer | null>(null);
  const hostStreamRef = useRef<MediaStream | null>(null);
  const hostConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hostPendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const viewerConnection = useRef<ReturnType<Peer["connect"]> | null>(null);
  const viewerRtc = useRef<RTCPeerConnection | null>(null);
  const viewerPendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [title, setTitle] = useState("");
  const [hostSessionId, setHostSessionId] = useState<string | null>(null);
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [sessions, setSessions] = useState<LiveSessionRow[]>([]);
  const [watchingTitle, setWatchingTitle] = useState("");
  const [viewerStream, setViewerStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Not live");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationRequests, setLocationRequests] = useState<Array<{ id: string; viewer_user_id: string; status: string }>>([]);
  const [watchingSessionId, setWatchingSessionId] = useState<string | null>(null);
  const [locationRequestStatus, setLocationRequestStatus] = useState<string | null>(null);
  const [sharedLocation, setSharedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationWatchId = useRef<number | null>(null);

  // Show the host's camera preview.
  useEffect(() => {
    if (hostVideoRef.current) {
      hostVideoRef.current.srcObject = hostStream;
    }
  }, [hostStream]);

  // Show the incoming stream from the host.
  useEffect(() => {
    if (viewerVideoRef.current) {
      viewerVideoRef.current.srcObject = viewerStream;
    }
  }, [viewerStream]);

  // Find active streams. A heartbeat older than 60 seconds is treated as offline.
  useEffect(() => {
    let active = true;

    async function loadSessions() {
      const cutoff = new Date(Date.now() - 60_000).toISOString();

      const { data, error } = await (supabase as any)
        .from("live_sessions")
        .select("id, host_user_id, title, peer_id, created_at, last_seen_at")
        .eq("status", "live")
        .gt("last_seen_at", cutoff)
        .order("created_at", { ascending: false });

      if (!error && active) {
        setSessions((data ?? []) as LiveSessionRow[]);
      }
    }

    void loadSessions();
    const timer = window.setInterval(() => void loadSessions(), 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Keep the host's session alive while the camera is broadcasting.
  useEffect(() => {
    if (!hostSessionId) return;

    const timer = window.setInterval(() => {
      void (supabase as any)
        .from("live_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", hostSessionId);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [hostSessionId]);

  useEffect(() => {
    if (!hostSessionId) { setLocationRequests([]); return; }
    let active = true;
    const load = async () => {
      const { data, error } = await (supabase as any).from("live_location_access")
        .select("id, viewer_user_id, status").eq("session_id", hostSessionId).order("requested_at");
      if (!error && active) setLocationRequests(data ?? []);
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hostSessionId]);

  useEffect(() => {
    if (!watchingSessionId || !user?.id) {
      setSharedLocation(null); setLocationRequestStatus(null); return;
    }
    let active = true;
    const refresh = async () => {
      const [{ data: access }, { data: location }] = await Promise.all([
        (supabase as any).from("live_location_access").select("status")
          .eq("session_id", watchingSessionId).eq("viewer_user_id", user.id).maybeSingle(),
        (supabase as any).from("live_session_locations")
          .select("latitude, longitude").eq("session_id", watchingSessionId).maybeSingle(),
      ]);
      if (active) { setLocationRequestStatus(access?.status ?? null); setSharedLocation(location ?? null); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [watchingSessionId, user?.id]);

  // Clean up local camera and peer connections if this component closes.
  useEffect(() => {
    return () => {
      if (locationWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId.current);
      peerRef.current?.destroy();
      hostStreamRef.current?.getTracks().forEach((track) => track.stop());
      hostConnections.current.forEach((connection) => connection.close());
      viewerRtc.current?.close();
    };
  }, []);

  async function startLive() {
    if (!user) {
      toast.error("Sign in before starting a live stream.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access requires a supported browser and a secure HTTPS connection.");
      return;
    }

    if (peerRef.current || hostSessionId) {
      toast.error("You are already hosting a live stream.");
      return;
    }

    setBusy(true);

    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });

      hostStreamRef.current = camera;
      setHostStream(camera);

      const peer = new Peer(undefined, { config: LIVE_RTC_CONFIG });
      peerRef.current = peer;

      peer.on("connection", (connection) => {
        connection.on("data", async (raw) => {
          const message = raw as LiveSignal;

          if (message.type === "leave") {
            hostConnections.current.get(connection.peer)?.close();
            hostConnections.current.delete(connection.peer);
            hostPendingCandidates.current.delete(connection.peer);
            return;
          }

          if (message.type === "offer" && message.sdp) {
            try {
              hostConnections.current.get(connection.peer)?.close();

              const rtc = new RTCPeerConnection(LIVE_RTC_CONFIG);
              hostConnections.current.set(connection.peer, rtc);

              camera.getTracks().forEach((track) => {
                rtc.addTrack(track, camera);
              });

              rtc.onicecandidate = (event) => {
                if (event.candidate && connection.open) {
                  connection.send({
                    type: "candidate",
                    candidate: event.candidate.toJSON(),
                  } satisfies LiveSignal);
                }
              };

              await rtc.setRemoteDescription(message.sdp);

              const queued =
                hostPendingCandidates.current.get(connection.peer) ?? [];
              for (const candidate of queued) {
                await rtc.addIceCandidate(candidate);
              }
              hostPendingCandidates.current.delete(connection.peer);

              const answer = await rtc.createAnswer();
              await rtc.setLocalDescription(answer);

              connection.send({
                type: "answer",
                sdp: rtc.localDescription,
              } satisfies LiveSignal);
            } catch (error) {
              console.error("Host connection error:", error);
              toast.error("A viewer could not connect.");
            }
          }

          if (message.type === "candidate" && message.candidate) {
            const rtc = hostConnections.current.get(connection.peer);

            if (rtc?.remoteDescription) {
              await rtc.addIceCandidate(message.candidate).catch(console.error);
            } else {
              const queued =
                hostPendingCandidates.current.get(connection.peer) ?? [];
              queued.push(message.candidate);
              hostPendingCandidates.current.set(connection.peer, queued);
            }
          }
        });

        connection.on("close", () => {
          hostConnections.current.get(connection.peer)?.close();
          hostConnections.current.delete(connection.peer);
          hostPendingCandidates.current.delete(connection.peer);
        });
      });

      peer.on("open", async (peerId) => {
        try {
          const { data, error } = await (supabase as any)
            .from("live_sessions")
            .insert({
              host_user_id: user.id,
              title: title.trim() || "Nexora Live",
              peer_id: peerId,
              status: "live",
            })
            .select("id")
            .single();

          if (error) throw error;

          setHostSessionId(data.id);
          setStatus("You are LIVE");
          toast.success("Your live stream has started.");
        } catch (error) {
          console.error(error);
          camera.getTracks().forEach((track) => track.stop());
          peer.destroy();
          peerRef.current = null;
          hostStreamRef.current = null;
          setHostStream(null);
          setStatus("Could not start live");
          toast.error("Could not save your live session. Check the Supabase SQL setup.");
        } finally {
          setBusy(false);
        }
      });

      peer.on("error", (error) => {
        console.error("PeerJS error:", error);
        toast.error(`Live connection error: ${error.message}`);
        setBusy(false);
      });
    } catch (error) {
      console.error(error);
      setBusy(false);
      setStatus("Camera unavailable");
      toast.error(
        "Camera or microphone access failed. Allow permissions in your browser and try again.",
      );
    }
  }

  async function endLive() {
    await stopLocationSharing();
    const sessionId = hostSessionId;

    hostConnections.current.forEach((connection) => connection.close());
    hostConnections.current.clear();
    hostPendingCandidates.current.clear();

    hostStreamRef.current?.getTracks().forEach((track) => track.stop());
    hostStreamRef.current = null;

    peerRef.current?.destroy();
    peerRef.current = null;

    setHostStream(null);
    setHostSessionId(null);
    setStatus("Not live");

    if (sessionId) {
      const { error } = await (supabase as any)
        .from("live_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        toast.error("The stream ended, but its session status could not be updated.");
      }
    }

    toast.success("Your live stream has ended.");
  }

  async function joinLive(session: LiveSessionRow) {
    setWatchingSessionId(session.id);
    leaveLive();

    setBusy(true);
    setWatchingTitle(session.title);
    setStatus("Connecting to host…");

    const peer = new Peer(undefined, { config: LIVE_RTC_CONFIG });
    peerRef.current = peer;

    peer.on("open", () => {
      const connection = peer.connect(session.peer_id, { reliable: true });
      viewerConnection.current = connection;

      connection.on("data", async (raw) => {
        const message = raw as LiveSignal;
        const rtc = viewerRtc.current;

        if (!rtc) return;

        if (message.type === "answer" && message.sdp) {
          try {
            await rtc.setRemoteDescription(message.sdp);

            for (const candidate of viewerPendingCandidates.current) {
              await rtc.addIceCandidate(candidate);
            }
            viewerPendingCandidates.current = [];
            setStatus("Connected to live stream");
          } catch (error) {
            console.error(error);
            toast.error("Could not establish the live video connection.");
          }
        }

        if (message.type === "candidate" && message.candidate) {
          if (rtc.remoteDescription) {
            await rtc.addIceCandidate(message.candidate).catch(console.error);
          } else {
            viewerPendingCandidates.current.push(message.candidate);
          }
        }
      });

      connection.on("open", async () => {
        try {
          const rtc = new RTCPeerConnection(LIVE_RTC_CONFIG);
          viewerRtc.current = rtc;

          rtc.addTransceiver("video", { direction: "recvonly" });
          rtc.addTransceiver("audio", { direction: "recvonly" });

          rtc.ontrack = (event) => {
            const incoming = event.streams[0] ?? new MediaStream([event.track]);
            setViewerStream(incoming);
          };

          rtc.onicecandidate = (event) => {
            if (event.candidate && connection.open) {
              connection.send({
                type: "candidate",
                candidate: event.candidate.toJSON(),
              } satisfies LiveSignal);
            }
          };

          rtc.onconnectionstatechange = () => {
            if (rtc.connectionState === "failed") {
              setStatus("Connection failed. Try joining again.");
            }
            if (rtc.connectionState === "connected") {
              setStatus("Connected to live stream");
            }
          };

          const offer = await rtc.createOffer();
          await rtc.setLocalDescription(offer);

          connection.send({
            type: "offer",
            sdp: rtc.localDescription,
          } satisfies LiveSignal);
        } catch (error) {
          console.error(error);
          toast.error("Could not join this live stream.");
          setStatus("Connection failed");
          setBusy(false);
        }
      });

      connection.on("error", (error) => {
        console.error(error);
        toast.error("Could not connect to the host.");
        setStatus("Connection failed");
        setBusy(false);
      });

      connection.on("close", () => {
        setStatus("Host disconnected");
      });

      setBusy(false);
    });

    peer.on("error", (error) => {
      console.error(error);
      toast.error(`Could not join live: ${error.message}`);
      setStatus("Connection failed");
      setBusy(false);
    });
  }

  function leaveLive() {
    setWatchingSessionId(null);
    setSharedLocation(null);
    setLocationRequestStatus(null);
    if (viewerConnection.current?.open) {
      viewerConnection.current.send({ type: "leave" } satisfies LiveSignal);
    }

    viewerRtc.current?.close();
    viewerRtc.current = null;

    viewerConnection.current?.close();
    viewerConnection.current = null;

    viewerPendingCandidates.current = [];

    if (!hostSessionId) {
      peerRef.current?.destroy();
      peerRef.current = null;
    }

    setViewerStream(null);
    setWatchingTitle("");
    setStatus(hostSessionId ? "You are LIVE" : "Not live");
  }

  return (
    <Panel className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Radio className="h-4 w-4 text-destructive" />
        Nexora LIVE
      </h2>

      <p className="text-xs text-muted-foreground">{status}</p>

      <video
        ref={hostVideoRef}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full rounded-xl bg-black object-cover"
      />

      <input
        aria-label="Live stream title"
        className={input}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What are you going live about?"
        maxLength={100}
        disabled={Boolean(hostSessionId)}
      />

      {hostSessionId && (
        <div className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium">Live location</p><p className="text-xs text-muted-foreground">Only viewers you approve can see it</p></div>
            <Button type="button" size="sm" variant={locationEnabled ? "default" : "outline"} onClick={toggleLocationSharing}>
              {locationEnabled ? <MapPin className="mr-2 h-4 w-4" /> : <MapPinOff className="mr-2 h-4 w-4" />}
              {locationEnabled ? "Location ON" : "Location OFF"}
            </Button>
          </div>
          {locationRequests.filter((r) => r.status === "pending").map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
              <span className="truncate">Viewer {request.viewer_user_id.slice(0, 8)}…</span>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => void decideLocationAccess(request.id, "approved")}><Check className="h-3 w-3" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => void decideLocationAccess(request.id, "denied")}><X className="h-3 w-3" /> Decline</Button>
              </div>
            </div>
          ))}
          {locationRequests.filter((r) => r.status === "approved").map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-2 text-xs">
              <span>Approved viewer {request.viewer_user_id.slice(0, 8)}…</span>
              <Button size="sm" variant="outline" onClick={() => void decideLocationAccess(request.id, "denied")}>Revoke</Button>
            </div>
          ))}
        </div>
      )}

      {hostSessionId ? (
        <Button variant="destructive" className="w-full" onClick={endLive}>
          <Square className="mr-2 h-4 w-4" />
          End live stream
        </Button>
      ) : (
        <Button className="w-full" onClick={startLive} disabled={busy || !user}>
          <Radio className="mr-2 h-4 w-4" />
          {busy ? "Starting…" : "Start live stream"}
        </Button>
      )}

      {!user && (
        <p className="text-xs text-muted-foreground">
          Sign in to host a live stream. You can still watch public streams.
        </p>
      )}

      <div className="border-t pt-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Live now
        </h3>

        {sessions.filter((session) => session.host_user_id !== user?.id).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other creators are live right now.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions
              .filter((session) => session.host_user_id !== user?.id)
              .map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-2 rounded-xl border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session.title}</p>
                    <p className="text-xs text-destructive">LIVE</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void joinLive(session)}
                    disabled={busy || Boolean(hostSessionId)}
                  >
                    Watch
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {watchingTitle && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">{watchingTitle}</p>
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Host live location</p>
              {locationRequestStatus === "approved" ? <span className="text-xs text-green-600">Approved</span> :
                <Button size="sm" variant="outline" onClick={() => void requestLocationAccess()}
                  disabled={!user || locationRequestStatus === "pending" || locationRequestStatus === "denied"}>
                  <MapPin className="mr-1 h-3 w-3" />
                  {locationRequestStatus === "pending" ? "Request pending" : locationRequestStatus === "denied" ? "Request declined" : "Request access"}
                </Button>}
            </div>
            {sharedLocation && locationRequestStatus === "approved" && (
              <a className="mt-2 inline-flex text-xs text-primary underline" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${sharedLocation.latitude},${sharedLocation.longitude}`}>Open live location in Maps</a>
            )}
            {locationRequestStatus === "approved" && !sharedLocation && <p className="mt-1 text-xs text-muted-foreground">The host has not turned location sharing on.</p>}
            {!locationRequestStatus && <p className="mt-1 text-xs text-muted-foreground">Request permission from the host to view their location.</p>}
          </div>
          <video
            ref={viewerVideoRef}
            autoPlay
            playsInline
            controls
            className="aspect-video w-full rounded-xl bg-black object-contain"
          />
          <Button variant="outline" className="w-full" onClick={leaveLive}>
            Leave live stream
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Free peer-to-peer broadcast. Video is sent directly from the host's device to each viewer.
        Viewer capacity depends on the host's upload speed and network.
      </p>
    </Panel>
  );
              }
