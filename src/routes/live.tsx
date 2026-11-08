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
  const ranked = useMemo(() => prioritizeLive(creators, seedLive), []);
  const [watching, setWatching] = useState(seedLive[0].id);
  const stream = seedLive.find((s) => s.id === watching) ?? seedLive[0];
  const [tips, setTips] = useLocal<Tip[]>("nx.tips", []);
  const [tipAmt, setTipAmt] = useState("100");
  const [poll, setPoll] = useState<Poll>({
    question: "Which spot next?",
    options: [
      { label: "Market", votes: 4 },
      { label: "Beach", votes: 2 },
    ],
  });
  const [questions, setQuestions] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [presets, setPresets] = useLocal<Preset[]>("nx.actPresets", []);
  const [checkins, setCheckins] = useLocal<{ place: string; day: string }[]>("nx.checkins", []);
  const [consent, setConsent] = useLocal("nx.checkinConsent", false);
  const today = new Date().toISOString().slice(0, 10);

  function tip() {
    const amt = Number(tipAmt);
    const err = tipError(amt, balance);
    if (err) {
      toast.error(err);
      return;
    }
    sendMoney(stream.creator, amt, "LIVE tip (demo)");
    setTips((t) => [...t, { from: "You", to: stream.creator, amount: amt, verified: true }]);
    bus.emit("tip:sent", { to: stream.creator, amount: amt });
    toast.success(`Demo tip of ${fmtKES(amt)} recorded — no real money moved.`);
  }
  function checkIn() {
    const place = stream.place;
    if (!consent || !place) return;
    setCheckins((c) => [...c, { place, day: today }]);
    bus.emit("checkin:made", { place });
    toast.success(`Checked in at ${stream.place} (saved on this device)`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LIVE"
        subtitle="Live discovery, Go LIVE studio, tips, polls and co-watch"
        action={<DemoBadge>Simulated streams</DemoBadge>}
      />

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
              onClick={() => setPoll(vote(poll, i))}
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
              if (q.trim()) {
                setQuestions((x) => [q.trim(), ...x]);
                setQ("");
              }
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
              <li key={i} className="rounded-lg bg-muted px-2 py-1">
                {x}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            AI co-host: not connected. Questions are not answered automatically.
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
          <div className="map-grid relative h-48 rounded-2xl border">
            {seedLive.map((s) => (
              <button
                key={s.id}
                onClick={() => setWatching(s.id)}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label={`${s.creator} LIVE`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground"
              >
                LIVE
              </button>
            ))}
          </div>
          <DemoBadge>Simulated map — positions are illustrative</DemoBadge>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I agree to save venue check-ins to my Pulse Passport on this device
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
          <h3 className="pt-2 font-semibold">Demo tips leaderboard</h3>
          <ol className="text-sm">
            {leaderboard(tips).map((l) => (
              <li key={l.name}>
                {l.name} — {fmtKES(l.total)}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Only tips you sent from this device count. Real verification needs a payment provider.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function GoLive() {
  const ref = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(0);
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!mediaStream) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mediaStream]);
  useEffect(() => () => mediaStream?.getTracks().forEach((t) => t.stop()), [mediaStream]);
  async function go() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(s);
      setStart(Date.now());
      setNow(Date.now());
      if (ref.current) ref.current.srcObject = s;
      bus.emit("live:start", { title: title || "Untitled" });
    } catch (e) {
      const n = (e as Error).name;
      toast.error(
        n === "NotAllowedError"
          ? "Camera/microphone permission was blocked. Allow it in your browser settings."
          : "No camera available on this device.",
      );
    }
  }
  function end() {
    const secs = Math.round((Date.now() - start) / 1000);
    mediaStream?.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    bus.emit("live:end", { seconds: secs });
    toast(`Preview ended after ${secs}s`);
  }
  const secs = mediaStream ? Math.round((now - start) / 1000) : 0;
  return (
    <Panel className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Radio className="h-4 w-4 text-destructive" />
        Go LIVE
      </h2>
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full rounded-2xl bg-muted object-cover"
        aria-label="Camera preview"
      />
      <input
        aria-label="Stream title"
        className={input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Stream title"
      />
      {mediaStream ? (
        <Button variant="destructive" onClick={end}>
          <Square className="h-4 w-4" />
          End · {secs}s
        </Button>
      ) : (
        <Button onClick={go}>Start camera preview</Button>
      )}
      <p className="text-xs text-muted-foreground">
        Your camera preview is real and stays on this device. Broadcasting to viewers needs a
        streaming provider, which isn't connected.
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
