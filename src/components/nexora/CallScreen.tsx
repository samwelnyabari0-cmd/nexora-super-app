import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";

export const fmtCall = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const peers = [
  { id: "c1", name: "Amani Otieno", hue: 295 },
  { id: "c3", name: "Zuri Motion", hue: 330 },
];

type Phase = "idle" | "outgoing" | "incoming" | "active" | "ended";

/**
 * Full call screens (ringing, incoming, in-call) with real mic/camera capture on
 * consent. The peer is simulated — no call is ever placed and nothing is sent.
 */
export function CallScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [peer, setPeer] = useState(peers[0]);
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [declined, setDeclined] = useState(false);
  const [err, setErr] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);

  const stopMedia = useCallback(() => {
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
  }, []);

  const startMedia = useCallback(async () => {
    setErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      stopMedia();
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaRef.current = s;
      setPhase("active");
    } catch (e) {
      setPhase("idle");
      setErr(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera/mic permission denied. Allow it in your browser settings to use the call screen."
          : "Camera or microphone unavailable — the call screen needs both.",
      );
    }
  }, [stopMedia]);

  // Release camera/mic when the call screen unmounts.
  useEffect(() => () => stopMedia(), [stopMedia]);

  // Outgoing "rings" for a moment, then connects locally.
  useEffect(() => {
    if (phase !== "outgoing") return;
    const t = setTimeout(() => void startMedia(), 3500);
    return () => clearTimeout(t);
  }, [phase, startMedia]);

  useEffect(() => {
    if (phase !== "active") return;
    setSecs(0);
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  useEffect(() => {
    if (phase === "active" && videoRef.current && mediaRef.current)
      videoRef.current.srcObject = mediaRef.current;
  }, [phase]);

  useEffect(() => {
    mediaRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => {
    mediaRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const end = () => {
    stopMedia();
    setPhase("ended");
  };

  const ring = (p: (typeof peers)[number]) => {
    setPeer(p);
    setDeclined(false);
    setSecs(0);
    setPhase("outgoing");
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-semibold">Video calls</h2>
        <DemoBadge>Simulated peer</DemoBadge>
      </div>

      {err && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {err}
        </p>
      )}

      {phase === "idle" && (
        <>
          <p className="text-sm text-muted-foreground">
            Try the full call screens — ringing, incoming and in-call. Your camera and mic are used
            only with your permission; nobody else is ever connected.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {peers.map((p) => (
              <Button key={p.id} variant="outline" onClick={() => ring(p)}>
                <PhoneCall className="h-4 w-4" /> Call {p.name.split(" ")[0]}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                setPeer(peers[1]);
                setDeclined(false);
                setPhase("incoming");
              }}
            >
              Simulate incoming call
            </Button>
          </div>
        </>
      )}

      {phase === "outgoing" && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <Avatar name={peer.name} hue={peer.hue} size={72} ring />
          <p className="mt-3 font-display text-lg font-semibold">{peer.name}</p>
          <p className="text-sm text-muted-foreground">Ringing… (demo)</p>
          <div className="mt-4 flex justify-center">
            <Button variant="destructive" onClick={end}>
              <PhoneOff className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === "incoming" && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <Avatar name={peer.name} hue={peer.hue} size={72} ring />
          <p className="mt-3 font-display text-lg font-semibold">{peer.name}</p>
          <p className="text-sm text-muted-foreground">Incoming call — simulated, no one is calling.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                setDeclined(true);
                setPhase("ended");
              }}
            >
              <PhoneOff className="h-4 w-4" /> Decline
            </Button>
            <Button onClick={() => void startMedia()}>
              <Phone className="h-4 w-4" /> Accept
            </Button>
          </div>
        </div>
      )}

      {phase === "active" && (
        <div>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full rounded-xl bg-muted"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm tabular-nums" aria-live="polite">
              {peer.name} · {fmtCall(secs)}
            </p>
            <p className="text-xs font-semibold text-warning">Demo peer — only you are connected</p>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <Button
              variant={muted ? "default" : "outline"}
              size="icon"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              onClick={() => setMuted(!muted)}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              variant={camOn ? "outline" : "default"}
              size="icon"
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
              onClick={() => setCamOn(!camOn)}
            >
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            <Button variant="destructive" size="icon" aria-label="End call" onClick={end}>
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-display font-semibold">{declined ? "Call declined" : "Call ended"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {declined ? "Simulated call — nothing was connected." : `Duration ${fmtCall(secs)} — local demo only.`}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              stopMedia();
              setPhase("idle");
            }}
          >
            Back
          </Button>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Two-way calling needs a real calling provider (WebRTC backend). Nothing is transmitted and
        no call is ever placed.
      </p>
    </>
  );
}
