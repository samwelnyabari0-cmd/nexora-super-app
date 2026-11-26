import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Avatar } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { nextCameraFacingMode, setMediaTracksEnabled, supportsCameraFacingMode } from "@/components/nexora/call-media";

type Person = { id: string; display_name: string | null; handle: string | null };
export type CallInvite = {
  id: string;
  caller: string;
  callee: string;
  kind: "audio" | "video";
  status: string;
  callee_peer_id: string | null;
};

const peerConfig = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ...(import.meta.env.VITE_TURN_URL
      ? [{
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        }]
      : []),
  ],
};

const label = (p?: Person) => p?.display_name || (p?.handle ? `@${p.handle}` : "NEXORA user");

function mediaFor(kind: "audio" | "video") {
  return navigator.mediaDevices.getUserMedia(
    kind === "video" ? { audio: true, video: true } : { audio: true },
  );
}

export function CallSession({ invite, userId, other }: { invite: Invite; userId: string; other?: Person }) {
  const isCaller = invite.caller === userId;
  const [connected, setConnected] = useState(false);
  const [err, setErr] = useState("");
  const [muted, setMuted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const mutedRef = useRef(false);
  const cameraOnRef = useRef(true);
  const endingRef = useRef(false);
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const peer = useRef<any>(null);
  const call = useRef<any>(null);
  const mounted = useRef(true);

  const cleanup = useCallback(() => {
    const activeCall = call.current;
    call.current = null;
    activeCall?.close();
    const activePeer = peer.current;
    peer.current = null;
    activePeer?.destroy();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (local.current) local.current.srcObject = null;
    if (remote.current) remote.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cleanup();
      if (!endingRef.current) {
        void (async () => {
          const { data } = await supabase
            .from("call_invites")
            .select("status")
            .eq("id", invite.id)
            .maybeSingle();
          if (data?.status === "ringing" || data?.status === "accepted") {
            await supabase
              .from("call_invites")
              .update({ status: isCaller && data.status === "ringing" ? "cancelled" : "ended" })
              .eq("id", invite.id);
          }
        })();
      }
    };
  }, [cleanup, invite.id, isCaller]);

  const attach = (localStream: MediaStream, remoteStream?: MediaStream) => {
    setMediaTracksEnabled(localStream.getAudioTracks(), !mutedRef.current);
    setMediaTracksEnabled(localStream.getVideoTracks(), cameraOnRef.current);
    if (local.current) local.current.srcObject = localStream;
    if (remoteStream) {
      if (remote.current) remote.current.srcObject = remoteStream;
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = remoteStream;
        void remoteAudio.current.play().catch(() => {
          if (mounted.current) { setAudioBlocked(true); setErr("Your browser blocked automatic call audio."); }
        });
      }
      if (mounted.current) setConnected(true);
    }
  };

  const setStatus = (status: string, extra: Record<string, string> = {}) =>
    supabase.from("call_invites").update({ status, ...extra }).eq("id", invite.id);

  const fail = (message: string) => {
    endingRef.current = true;
    cleanup();
    if (mounted.current) {
      setConnected(false);
      setErr(message);
    }
    void setStatus("ended");
  };

  const watchCall = (activeCall: any, localStream: MediaStream) => {
    call.current = activeCall;
    activeCall.on("stream", (remoteStream: MediaStream) => attach(localStream, remoteStream));
    activeCall.on("close", () => {
      if (call.current !== activeCall) return;
      endingRef.current = true;
      call.current = null;
      cleanup();
      if (mounted.current) setConnected(false);
      void setStatus("ended");
    });
    activeCall.on("error", () => fail("The call connection failed. Check your network or try again."));
  };

  const accept = async () => {
    if (accepting) return;
    setAccepting(true);
    setErr("");
    try {
      const localStream = await mediaFor(invite.kind);
      if (!mounted.current) {
        localStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = localStream;
      attach(localStream);
      const { default: Peer } = await import("peerjs");
      if (!mounted.current) {
        localStream.getTracks().forEach((track) => track.stop());
        return;
      }
      const activePeer = new Peer({ config: peerConfig });
      peer.current = activePeer;
      activePeer.on("call", (incomingCall: any) => {
        if (!mounted.current) {
          incomingCall.close();
          return;
        }
        incomingCall.answer(localStream);
        watchCall(incomingCall, localStream);
      });
      activePeer.on("open", (id: string) => {
        void setStatus("accepted", { callee_peer_id: id }).then(({ error: updateError }) => {
          if (updateError) fail("Your call could not be accepted. Please try again.");
        });
      });
      activePeer.on("error", () => fail("Call signalling failed. Check your network or try again."));
    } catch {
      cleanup();
      if (mounted.current) {
        setErr(
          invite.kind === "audio"
            ? "Microphone permission is needed to answer."
            : "Camera and microphone permission are needed to answer.",
        );
      }
    } finally {
      if (mounted.current) setAccepting(false);
    }
  };

  useEffect(() => {
    if (!isCaller || invite.status !== "accepted" || !invite.callee_peer_id || peer.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const localStream = await mediaFor(invite.kind);
        if (cancelled || !mounted.current) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = localStream;
        attach(localStream);
        const { default: Peer } = await import("peerjs");
        if (cancelled || !mounted.current) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        const activePeer = new Peer({ config: peerConfig });
        peer.current = activePeer;
        activePeer.on("open", () => {
          if (cancelled || !mounted.current) return;
          const outgoingCall = activePeer.call(invite.callee_peer_id!, localStream);
          watchCall(outgoingCall, localStream);
        });
        activePeer.on("error", () => fail("Call signalling failed. Check your network or configure TURN."));
      } catch {
        if (!cancelled && mounted.current) {
          endingRef.current = true;
          cleanup();
          setErr("Permission to use your microphone/camera was denied.");
          void setStatus("ended");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [cleanup, invite.callee_peer_id, invite.kind, invite.status, isCaller]);

  useEffect(() => {
    mutedRef.current = muted;
    if (stream.current) setMediaTracksEnabled(stream.current.getAudioTracks(), !muted);
  }, [muted]);

  useEffect(() => {
    cameraOnRef.current = cameraOn;
    if (stream.current) setMediaTracksEnabled(stream.current.getVideoTracks(), cameraOn);
  }, [cameraOn]);

  const switchCamera = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) {
      setErr("A video camera is not available for this call.");
      return;
    }
    const nextMode = nextCameraFacingMode(facingMode);
    try {
      const capabilities = track.getCapabilities?.();
      if (!supportsCameraFacingMode(capabilities?.facingMode, nextMode)) {
        setErr("This device does not expose another camera.");
        return;
      }
      await track.applyConstraints({ facingMode: { ideal: nextMode } });
      setFacingMode(nextMode);
      setErr("");
    } catch {
      setErr("Camera switching is not supported by this device or browser.");
    }
  };

  const hangUp = () => {
    endingRef.current = true;
    cleanup();
    setConnected(false);
    void setStatus(isCaller && invite.status === "ringing" ? "cancelled" : "ended");
  };
  const decline = () => {
    endingRef.current = true;
    cleanup();
    void setStatus("declined");
  };

  return (
    <Panel className="border-accent">
      <div className="text-center">
        <Avatar name={label(other)} size={64} ring />
        <p className="mt-2 font-display text-lg font-semibold">{label(other)}</p>
        <p className="text-sm text-muted-foreground">
          {invite.kind === "video" ? "Video" : "Voice"} call ·{" "}
          {invite.status === "ringing"
            ? isCaller
              ? "Ringing… waiting for them to accept"
              : "Incoming call"
            : connected
              ? "Connected"
              : "Connecting…"}
        </p>
        {err && <p role="alert" className="mt-1 text-sm text-destructive">{err}</p>}
      </div>

      {invite.kind === "video" && invite.status === "accepted" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <video ref={remote} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-muted" />
          <video ref={local} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-muted" />
        </div>
      )}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      {audioBlocked && (
        <div className="mt-3 text-center">
          <Button variant="outline" onClick={() => {
            void remoteAudio.current?.play().then(() => {
              setAudioBlocked(false);
              setErr("");
            }).catch(() => setErr("Call audio is still blocked by the browser."));
          }}>
            Enable call audio
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {!isCaller && invite.status === "ringing" ? (
          <>
            <Button variant="destructive" onClick={decline}>
              <PhoneOff className="h-4 w-4" /> Decline
            </Button>
            <Button disabled={accepting} onClick={() => void accept()}>{accepting ? "Connecting…" : <PhoneCall className="h-4 w-4" />}
              {!accepting && "Accept"}
            </Button>
          </>
        ) : (
          <>
            {invite.status === "accepted" && (
              <>
                <Button variant={muted ? "default" : "outline"} size="icon" aria-label={muted ? "Unmute microphone" : "Mute microphone"} onClick={() => setMuted((value) => !value)}>
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                {invite.kind === "video" && (
                  <>
                    <Button variant={cameraOn ? "outline" : "default"} size="icon" aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} onClick={() => setCameraOn((value) => !value)}>
                      {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Switch camera" onClick={() => void switchCamera()}>
                      <SwitchCamera className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
            <Button variant="destructive" onClick={hangUp}>
              <PhoneOff className="h-4 w-4" /> Hang up
            </Button>
          </>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Peer-to-peer via the public PeerJS signalling service. Google STUN is used; TURN is optional and must be configured for some restrictive networks.
      </p>
    </Panel>
  );
}

