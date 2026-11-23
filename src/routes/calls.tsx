import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, Copy, Search, UserPlus, Check, X, Crown, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageHeader, Panel, Avatar } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { nextCameraFacingMode, setMediaTracksEnabled, supportsCameraFacingMode } from "@/components/nexora/call-media";

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

export const Route = createFileRoute("/calls")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite.slice(0, 32) : undefined,
    arenaAudio: s.arenaAudio === true || s.arenaAudio === "true",
  }),
  head: () => ({
    meta: [
      { title: "Calls — NEXORA" },
      {
        name: "description",
        content:
          "Private 1:1 voice and video calls with your accepted NEXORA contacts, plus Jitsi group rooms.",
      },
      { property: "og:title", content: "Calls — NEXORA" },
      {
        property: "og:description",
        content: "Consent-first voice and video calls between contacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallsPage,
});

type Person = { id: string; display_name: string | null; handle: string | null };
type Contact = { id: string; requester: string; addressee: string; status: string };
type Invite = {
  id: string;
  caller: string;
  callee: string;
  kind: "audio" | "video";
  status: string;
  callee_peer_id: string | null;
};

const label = (p?: Person) => p?.display_name || (p?.handle ? `@${p.handle}` : "NEXORA user");
const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function mediaFor(kind: "audio" | "video") {
  // Audio calls request microphone only.
  return navigator.mediaDevices.getUserMedia(
    kind === "video" ? { audio: true, video: true } : { audio: true },
  );
}

function CallsPage() {
  const { user, ready } = useSession();
  const { invite, arenaAudio } = Route.useSearch();

  const appMetadata = user?.app_metadata ?? {};
  const rawTier = appMetadata.subscription_tier ?? appMetadata.plan;
  const expiresAt = Date.parse(String(appMetadata.subscription_expires_at ?? ""));
  const hasActivePaidPlan =
    (rawTier === "pro" || rawTier === "studio") &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();

  const userPlan = hasActivePaidPlan ? rawTier : "free";
  const planLabel =
    userPlan === "studio" ? "Studio" :
    userPlan === "pro" ? "Pro" : "Free";

  if (!ready) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <PageHeader
        title="Calls"
        subtitle="Private voice and video calls with your NEXORA contacts."
      />

      {/* Premium Calls Header */}
      <section className="overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              PRIVATE NEXORA CALLS
            </div>

            <h2 className="text-2xl font-bold sm:text-3xl">
              Your people. One tap away.
            </h2>

            <p className="mt-2 text-sm leading-6 text-indigo-100/75">
              Call accepted contacts, answer incoming calls,
              or start a group room. Your camera and microphone
              are requested when you start or accept a call.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
              Account plan
            </p>

            <div className="mt-2 flex items-center gap-2 text-xl font-bold">
              {userPlan === "studio"
                ? <Sparkles className="h-5 w-5 text-cyan-300" />
                : <Crown className="h-5 w-5 text-amber-300" />}

              {user ? planLabel : "Sign in"}
            </div>

            <p className="mt-1 text-xs text-indigo-100/70">
              Calling is included on every plan.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription plan indicators */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-2xl border p-4 ${
          user && userPlan === "free"
            ? "border-cyan-400/50 bg-cyan-400/[0.07]"
            : "border-border bg-card"
        }`}>
          <p className="font-semibold">Free</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Direct audio calls, video calls, contacts and group rooms.
          </p>
          <p className="mt-3 text-[11px] font-semibold text-emerald-500">
            Calling included
          </p>
          {user && userPlan === "free" && (
            <span className="mt-2 inline-block text-[10px] font-bold text-cyan-500">
              CURRENT PLAN
            </span>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${
          userPlan === "pro"
            ? "border-indigo-400/50 bg-indigo-400/[0.07]"
            : "border-border bg-card"
        }`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Pro</p>
            <Crown className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ad-free viewing, background play, expanded uploads
            and Pro creator tools.
          </p>
          {user && userPlan === "pro" ? (
            <p className="mt-3 text-[10px] font-bold text-indigo-500">
              CURRENT PLAN
            </p>
          ) : (
            <Link to="/subscriptions"
              className="mt-3 inline-block text-[11px] font-semibold text-indigo-500 hover:underline">
              Explore Pro →
            </Link>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${
          userPlan === "studio"
            ? "border-cyan-400/50 bg-cyan-400/[0.07]"
            : "border-border bg-card"
        }`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Studio</p>
            <Sparkles className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Advanced creator tools, deeper analytics and
            professional publishing features.
          </p>
          {user && userPlan === "studio" ? (
            <p className="mt-3 text-[10px] font-bold text-cyan-500">
              CURRENT PLAN
            </p>
          ) : (
            <Link to="/subscriptions"
              className="mt-3 inline-block text-[11px] font-semibold text-cyan-600 hover:underline">
              Explore Studio →
            </Link>
          )}
        </div>
      </section>

      {/* Existing working calling system — preserved */}
      {user ? (
        <SignedInCalls userId={user.id} inviteCode={invite} />
      ) : (
        <Panel className="mb-4">
          <p className="text-sm">
            Sign in to call your contacts. Calls only work between
            accounts that have accepted each other.
          </p>
          <Button asChild className="mt-3">
            <Link to="/auth">Sign in to make calls</Link>
          </Button>
        </Panel>
      )}

      <CameraCheck />
      <JitsiRoom audioOnly={arenaAudio} />
    </div>
  );
          }
function SignedInCalls({ userId, inviteCode }: { userId: string; inviteCode?: string }) {
  const [me, setMe] = useState<{ invite_code: string | null; discoverable: boolean } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [names, setNames] = useState<Record<string, Person>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [code, setCode] = useState(inviteCode ?? "");

  const load = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: i }] = await Promise.all([
      supabase.from("profiles").select("invite_code, discoverable").eq("id", userId).maybeSingle(),
      supabase.from("contacts").select("id, requester, addressee, status"),
      supabase
        .from("call_invites")
        .select("id, caller, callee, kind, status, callee_peer_id")
        .in("status", ["ringing", "accepted"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setMe(p ?? null);
    setContacts(c ?? []);
    setInvites((i ?? []) as Invite[]);
    const ids = new Set<string>();
    (c ?? []).forEach((x) => ids.add(x.requester === userId ? x.addressee : x.requester));
    (i ?? []).forEach((x) => ids.add(x.caller === userId ? x.callee : x.caller));
    if (ids.size) {
      const { data: n } = await supabase.rpc("contact_names", { ids: [...ids] });
      setNames(Object.fromEntries((n ?? []).map((x: Person) => [x.id, x])));
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`calls-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_invites" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_directory", { q: q.trim() });
      setResults(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const redeem = async (c: string) => {
    const { error } = await supabase.rpc("redeem_invite", { code: c.trim() });
    if (error) toast.error("That invite code isn't valid.");
    else {
      toast.success("Contact added");
      setCode("");
      void load();
    }
  };
  useEffect(() => {
    if (inviteCode) void redeem(inviteCode);
  }, [inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const request = async (id: string) => {
    const { error } = await supabase.from("contacts").insert({ requester: userId, addressee: id });
    toast[error ? "error" : "success"](
      error ? "Request already sent or not allowed." : "Contact request sent",
    );
    void load();
  };
  const respond = async (id: string, status: "accepted" | "declined") => {
    await supabase.from("contacts").update({ status }).eq("id", id);
    void load();
  };
  const toggleDiscoverable = async () => {
  const { error } = await supabase
    .from("profiles")
    .update({ discoverable: !me?.discoverable })
    .eq("id", userId);

  if (error) {
    toast.error("Could not update discovery: " + error.message);
    return;
  }

  toast.success("Discovery setting updated");
  void load();
};
  const startCall = async (callee: string, kind: "audio" | "video") => {
    const { error } = await supabase.from("call_invites").insert({ caller: userId, callee, kind });
    if (error) toast.error("You can only call accepted contacts.");
    void load();
  };

  const accepted = contacts.filter((c) => c.status === "accepted");
  const incomingReq = contacts.filter((c) => c.status === "pending" && c.addressee === userId);
  const active = invites[0];
  const link =
    me?.invite_code && typeof window !== "undefined"
      ? `${window.location.origin}/calls?invite=${me.invite_code}`
      : "";

  return (
    <div className="space-y-4">
      {active && (
        <LiveCall
          key={active.id}
          invite={active}
          userId={userId}
          other={names[active.caller === userId ? active.callee : active.caller]}
        />
      )}

      <Panel>
        <h2 className="mb-2 font-display font-semibold">Your invite link</h2>
        <p className="text-sm text-muted-foreground">
          Anyone who opens this link while signed in becomes your contact and can call you.
        </p>
        <div className="mt-2 flex gap-2">
          <input readOnly value={link} className={input} aria-label="Invite link" />
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy invite link"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void redeem(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter a friend's invite code"
            className={input}
            aria-label="Invite code"
          />
          <Button type="submit">Add</Button>
        </form>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!me?.discoverable} onChange={toggleDiscoverable} />
          Let other signed-in members find me by name in the directory
        </label>
      </Panel>

      <Panel>
        <h2 className="mb-2 font-display font-semibold">Find people</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members who opted in…"
            className={`${input} pl-9`}
            aria-label="Search directory"
          />
        </div>
        <ul className="mt-2 space-y-1">
          {results.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border p-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <Avatar name={label(p)} size={28} />
                {label(p)}
              </span>
              <Button size="sm" variant="outline" onClick={() => void request(p.id)}>
                <UserPlus className="h-4 w-4" /> Add
              </Button>
            </li>
          ))}
          {q.trim().length >= 2 && !results.length && (
            <li className="text-sm text-muted-foreground">No members found.</li>
          )}
        </ul>
      </Panel>

      {incomingReq.length > 0 && (
        <Panel>
          <h2 className="mb-2 font-display font-semibold">Contact requests</h2>
          {incomingReq.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1 text-sm">
              {label(names[c.requester])}
              <span className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Accept"
                  onClick={() => void respond(c.id, "accepted")}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Decline"
                  onClick={() => void respond(c.id, "declined")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </Panel>
      )}

      <Panel>
        <h2 className="mb-2 font-display font-semibold">Contacts</h2>
        {!accepted.length && (
          <p className="text-sm text-muted-foreground">No contacts yet — share your invite link.</p>
        )}
        {accepted.map((c) => {
          const other = c.requester === userId ? c.addressee : c.requester;
          return (
            <div key={c.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Avatar name={label(names[other])} size={28} />
                {label(names[other])}
              </span>
              <span className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Voice call"
                  disabled={!!active}
                  onClick={() => void startCall(other, "audio")}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Video call"
                  disabled={!!active}
                  onClick={() => void startCall(other, "video")}
                >
                  <Video className="h-4 w-4" />
                </Button>
              </span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

function LiveCall({ invite, userId, other }: { invite: Invite; userId: string; other?: Person }) {
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

function CameraCheck() {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  const test = async () => {
    setErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      setStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
    } catch (e) {
      setErr(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera/mic permission denied. Allow it in your browser settings."
          : "Camera or microphone unavailable.",
      );
    }
  };
  return (
    <Panel className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Check camera & mic</h2>
        {stream ? (
          <Button variant="outline" size="sm" onClick={() => setStream(null)}>
            Stop preview
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={test}>
            <Video className="h-4 w-4" /> Test camera & mic
          </Button>
        )}
      </div>
      {stream ? (
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className="mt-3 aspect-video w-full rounded-xl bg-muted"
        />
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Check your camera and mic before a call.</p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {err}
        </p>
      )}
    </Panel>
  );
}


function JitsiRoom({ audioOnly = false }: { audioOnly?: boolean }) {
  const [room, setRoom] = useState<string | null>(null);
  return (
    <Panel className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">{audioOnly ? "Audio watch-along (Jitsi Meet)" : "Group room (Jitsi Meet)"}</h2>
        {room ? (
          <Button variant="destructive" size="sm" onClick={() => setRoom(null)}>
            <PhoneOff className="h-4 w-4" /> Leave
          </Button>
        ) : (
          <Button size="sm" onClick={() => setRoom(`nexora-${crypto.randomUUID().slice(0, 12)}`)}>
            <Video className="h-4 w-4" /> Start room
          </Button>
        )}
      </div>
      {room ? (
        <>
          <iframe
            title="Jitsi room"
            src={`https://meet.jit.si/${room}${audioOnly ? "#config.startWithVideoMuted=true&config.startAudioOnly=true&config.disableVideo=true" : ""}`}
            allow={audioOnly ? "microphone; fullscreen" : "camera; microphone; display-capture; fullscreen"}
            className="mt-3 aspect-video w-full rounded-xl border"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Share link: https://meet.jit.si/{room} — mic, camera and screen share are controlled
            inside the room. Hosted by the public Jitsi service, which may ask you to sign in to
            start.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {audioOnly ? "Opens an audio-first watch-along room with video disabled." : "Opens a group room with a random name on meet.jit.si."}
        </p>
      )}
    </Panel>
  );
      }
        
