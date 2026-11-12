import Peer from "peerjs";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Radio,
  Users,
  MapPin,
  Gift,
  Zap,
  Tv,
  BarChart2,
  MessageSquare,
  Square,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DemoBadge, Panel, Avatar, Chip } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { creators, fmtKES } from "@/features/core/data";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import {
  seedLive,
  prioritizeLive,
  tipError,
  leaderboard,
  vote,
  bus,
  type Poll,
  type Tip,
  streak,
} from "@/features/live/logic";
import { useLocal } from "@/features/live/useLocal";

import { aiChat } from "@/lib/ai.functions";
import { PaystackTopUp } from "@/components/nexora/PaystackTopUp";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "LIVE — streams, co-watch & check-ins — NEXORA" },
      {
        name: "description",
        content:
          "Discover LIVE creators, go live with your camera, tip, run polls, co-watch and check in with consent.",
      },
      { property: "og:title", content: "NEXORA LIVE" },
      {
        property: "og:description",
        content: "LIVE discovery, Go LIVE studio, polls, co-watch rooms and consented check-ins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

type Preset = { name: string; action: string };
const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function LivePage() {
  const { balance, sendMoney } = useApp();
  const { user } = useSession();
  const ranked = useMemo(() => prioritizeLive(creators, seedLive), []);
  const [watching, setWatching] = useState(seedLive[0].id);
  const stream = seedLive.find((s) => s.id === watching) ?? seedLive[0];
  const [tips, setTips] = useLocal<Tip[]>("nx.tips", []);
  const [tipAmt, setTipAmt] = useState("100");
  const [pollChoice, setPollChoice] = useState<number | null>(null);
  const [poll, setPoll] = useState<Poll>({
    question: "Which spot next?",
    options: [
      { label: "Market", votes: 4 },
      { label: "Beach", votes: 2 },
    ],
  });
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [presets, setPresets] = useLocal<Preset[]>("nx.actPresets", []);
  const [checkins, setCheckins] = useState<{ place: string; day: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!user) return;
    void (supabase as any)
      .from("venue_checkins")
      .select("venue, checked_in_at")
      .order("checked_in_at", { ascending: false })
      .then(
        ({
          data,
          error,
        }: {
          data: Array<{ venue: string; checked_in_at: string }> | null;
          error: unknown;
        }) => {
          if (!error && data)
            setCheckins(
              data.map((row) => ({ place: row.venue, day: row.checked_in_at.slice(0, 10) })),
            );
        },
      );
  }, [user]);

  function tip() {
    const amt = Number(tipAmt);
    const err = tipError(amt, balance);
    if (err) {
      toast.error(err);
      return;
    }
    toast.error("Tips require a verified wallet balance. Open the Paystack checkout above first.");
  }
  async function checkIn() {
    const place = stream.place;
    if (!consent || !place) return;
    if (!user) {
      toast.error("Sign in to save check-ins to your Pulse Passport.");
      return;
    }
    const { error } = await (supabase as any).from("venue_checkins").insert({
      user_id: user.id,
      venue: place,
      source: "live",
    });
    if (error) {
      toast.error("Check-in could not be saved.");
      return;
    }
    setCheckins((c) => [{ place, day: today }, ...c]);
    bus.emit("checkin:made", { place });
    toast.success(`Checked in at ${stream.place}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LIVE"
        subtitle="Live discovery, Go LIVE studio, tips, polls and co-watch"
        action={<DemoBadge>Provider-backed controls</DemoBadge>}
      />
      <PaystackTopUp />

      <section aria-label="LIVE creators" className="flex gap-4 overflow-x-auto pb-2">
        {ranked.map((c) => (
          <button
            key={c.id}
            onClick={() => c.live && setWatching(c.live.id)}
            className="flex w-20 shrink-0 flex-col items-center gap-1 text-xs"
            aria-label={c.live ? `${c.name} is LIVE` : c.name}
          >
            <span className={c.live ? "rounded-full p-0.5 bg-destructive" : "rounded-full p-0.5"}>
              <Avatar name={c.name} hue={c.hue} size={56} />
            </span>
            {c.live && (
              <span className="-mt-3 rounded bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                LIVE
              </span>
            )}
            <span className="truncate w-full text-center">{c.name.split(" ")[0]}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="space-y-3">
          <div className="map-grid relative grid aspect-video place-items-center overflow-hidden rounded-2xl border bg-muted">
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
              <Radio className="h-3 w-3" />
              LIVE · demo
            </span>
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded bg-background/80 px-2 py-0.5 text-xs">
              <Users className="h-3 w-3" />
              {stream.viewers.toLocaleString()}
            </span>
            <p className="px-6 text-center font-display text-xl font-semibold">{stream.title}</p>
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-background/85 p-2">
              <Gift className="h-4 w-4 text-accent" aria-hidden />
              <label className="sr-only" htmlFor="tip">
                Tip amount (KES)
              </label>
              <input
                id="tip"
                inputMode="numeric"
                value={tipAmt}
                onChange={(e) => setTipAmt(e.target.value)}
                className="w-24 rounded-lg border bg-background px-2 py-1 text-sm"
              />
              <Button size="sm" onClick={tip}>
                Tip {stream.creator.split(" ")[0]}
              </Button>
              <span className="ml-auto text-[11px] text-muted-foreground">
                Demo wallet · {fmtKES(balance)}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {stream.creator}
            {stream.place ? ` · ${stream.place}` : ""}
            {stream.sponsored ? " · Sponsored" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {seedLive.map((s) => (
              <Chip key={s.id} active={s.id === watching} onClick={() => setWatching(s.id)}>
                {s.creator.split(" ")[0]}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart2 className="h-4 w-4" />
            Poll
          </h2>
          <p className="text-sm">{poll.question}</p>
          {poll.options.map((o, i) => (
            <Button
              key={o.label}
              variant="outline"
              className="w-full justify-between"
              onClick={() => { if (pollChoice === null) { setPollChoice(i); setPoll(vote(poll, i)); } }}
              disabled={pollChoice !== null}
            >
              {o.label}
              <span>{o.votes}</span>
            </Button>
          ))}
          <h2 className="flex items-center gap-2 pt-2 font-semibold">
            <MessageSquare className="h-4 w-4" />
            Q&amp;A
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (e.nativeEvent.isComposing || e.keyCode === 229 || !q.trim() || asking) return;
              const question = q.trim();
              if (!user) {
                toast.error("Sign in to ask the AI co-host questions.");
                return;
              }
              setQuestions((x) => [question, ...x]);
              setQ("");
              setAsking(true);
              void aiChat({
                data: {
                  messages: [
                    {
                      role: "user",
                      content: `Live stream: ${stream.title}. Host: ${stream.creator}. Answer this audience question concisely: ${question}`,
                    },
                  ],
                },
              })
                .then((result) => {
                  if (result.error) toast.error(result.error);
                  else setAnswers((current) => ({ ...current, [question]: result.text }));
                })
                .catch(() => toast.error("The AI co-host could not answer right now."))
                .finally(() => setAsking(false));
            }}
          >
            <input
              aria-label="Ask a question"
              className={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask the host"
            />
            <Button type="submit">Ask</Button>
          </form>
          <ul className="space-y-1 text-sm">
            {questions.map((x, i) => (
              <li key={`${x}-${i}`} className="space-y-1 rounded-lg bg-muted px-2 py-1">
                <p>{x}</p>
                {answers[x] && <p className="text-primary">AI co-host: {answers[x]}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {asking
              ? "AI co-host is answering…"
              : user
                ? "AI co-host ready · OpenAI via Vercel AI Gateway"
                : "Sign in to connect the AI co-host."}
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GoLive />
        <Panel className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4" />
            Live map
          </h2>
          <iframe
            title="Live Google map"
            src={`https://www.google.com/maps?q=${encodeURIComponent(stream.place || "Nairobi, Kenya")}&output=embed`}
            className="h-48 w-full rounded-2xl border"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I agree to save venue check-ins to my Pulse Passport
          </label>
          <Button disabled={!consent || !stream.place} onClick={checkIn}>
            <ShieldCheck className="h-4 w-4" />
            Check in at {stream.place ?? "—"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {checkins.length} check-ins · City Explorer streak{" "}
            {streak(
              checkins.map((c) => c.day),
              today,
            )}{" "}
            day(s). No location is read from your device.
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CoWatch />
        <Panel className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Zap className="h-4 w-4" />⚡ Act presets
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("n") || "").trim();
              if (!name) return;
              setPresets((p) => [...p, { name, action: String(f.get("a")) }]);
              bus.emit("act:preset", { name });
              e.currentTarget.reset();
            }}
          >
            <input
              name="n"
              aria-label="Preset name"
              className={input}
              placeholder="e.g. Save venue + invite crew"
            />
            <select
              name="a"
              aria-label="Action"
              className="rounded-xl border bg-background px-2 text-sm"
            >
              <option>event</option>
              <option>place</option>
              <option>chat</option>
              <option>checkout</option>
            </select>
            <Button type="submit">Save</Button>
          </form>
          <ul className="space-y-1 text-sm">
            {presets.map((p, i) => (
              <li key={i} className="flex justify-between rounded-lg bg-muted px-2 py-1">
                {p.name}
                <span className="text-muted-foreground">{p.action}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 font-semibold">Verified tips leaderboard</h3>
          <ol className="text-sm">
            {leaderboard(tips).map((l) => (
              <li key={l.name}>
                {l.name} — {fmtKES(l.total)}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Tips appear here only after the payment provider verifies the wallet transaction.
          </p>
        </Panel>
      </div>
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

  // Clean up local camera and peer connections if this component closes.
  useEffect(() => {
    return () => {
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
      
  function CoWatch() {
  const [room, setRoom] = useLocal<{ title: string; members: string[]; chat: string[] } | null>(
    "nx.cowatch",
    null,
  );
  const [msg, setMsg] = useState("");
  return (
    <Panel className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Tv className="h-4 w-4" />
        Co-watch room
      </h2>
      {!room ? (
        <Button onClick={() => setRoom({ title: "Watch party", members: ["You"], chat: [] })}>
          Create room
        </Button>
      ) : (
        <>
          <p className="text-sm">
            {room.title} · {room.members.join(", ")}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (msg.trim()) {
                setRoom({ ...room, chat: [...room.chat, msg.trim()] });
                setMsg("");
              }
            }}
          >
            <input
              aria-label="Room message"
              className={input}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Say something"
            />
            <Button type="submit">Send</Button>
          </form>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
            {room.chat.map((c, i) => (
              <li key={i} className="rounded-lg bg-muted px-2 py-1">
                You: {c}
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" onClick={() => setRoom(null)}>
            Leave room
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Local room only — inviting others needs a realtime service (Lovable Cloud).
      </p>
    </Panel>
  );
}
