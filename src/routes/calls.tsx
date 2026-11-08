import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Video, Copy, Search, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageHeader, Panel, Avatar } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";

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
  const { invite } = Route.useSearch();
  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Calls"
        subtitle="Start a real encrypted browser video room with camera, microphone, and screen sharing."
      />
      {user ? (
        <SignedInCalls userId={user.id} inviteCode={invite} />
      ) : (
        <Panel className="mb-4">
          <p className="text-sm">
            Sign in to call your contacts. Calls only work between accounts that have accepted each
            other.
          </p>
          <Button asChild className="mt-3">
            <Link to="/auth">Sign in to make calls</Link>
          </Button>
        </Panel>
      )}
      <JitsiRoom />
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
    await supabase.from("profiles").update({ discoverable: !me?.discoverable }).eq("id", userId);
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
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const peer = useRef<{ destroy: () => void } | null>(null);

  const cleanup = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    peer.current?.destroy();
    peer.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const attach = (s: MediaStream, remoteS?: MediaStream) => {
    if (local.current) local.current.srcObject = s;
    if (remoteS && remote.current) {
      remote.current.srcObject = remoteS;
      setConnected(true);
    }
  };

  const setStatus = (status: string, extra: Record<string, string> = {}) =>
    supabase
      .from("call_invites")
      .update({ status, ...extra })
      .eq("id", invite.id);

  // Callee: only after explicit Accept do we capture media and expose a peer id.
  const accept = async () => {
    try {
      const s = await mediaFor(invite.kind);
      stream.current = s;
      attach(s);
      const { default: Peer } = await import("peerjs");
      const p = new Peer({ config: peerConfig });
      peer.current = p;
      p.on("call", (call) => {
        call.answer(s);
        call.on("stream", (r) => attach(s, r));
      });
      p.on("open", (id) => void setStatus("accepted", { callee_peer_id: id }));
      p.on("error", () => setErr("Connection failed. Try again."));
    } catch {
      setErr(
        invite.kind === "audio"
          ? "Microphone permission is needed to answer."
          : "Camera and microphone permission are needed to answer.",
      );
    }
  };

  // Caller: connect media only once the recipient has accepted.
  useEffect(() => {
    if (!isCaller || invite.status !== "accepted" || !invite.callee_peer_id || peer.current) return;
    void (async () => {
      try {
        const s = await mediaFor(invite.kind);
        stream.current = s;
        attach(s);
        const { default: Peer } = await import("peerjs");
        const p = new Peer({ config: peerConfig });
        peer.current = p;
        p.on("open", () => {
          const call = p.call(invite.callee_peer_id!, s);
          call.on("stream", (r) => attach(s, r));
        });
        p.on("error", () => setErr("Call signalling failed. Check your network or configure TURN."));
      } catch {
        setErr("Permission to use your microphone/camera was denied.");
        void setStatus("ended");
      }
    })();
  }, [isCaller, invite.status, invite.callee_peer_id, invite.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const hangUp = () => {
    cleanup();
    void setStatus(isCaller && invite.status === "ringing" ? "cancelled" : "ended");
  };
  const decline = () => void setStatus("declined");

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
        {err && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {err}
          </p>
        )}
      </div>
      <div
        className={
          invite.kind === "video" && invite.status === "accepted"
            ? "mt-3 grid gap-2 sm:grid-cols-2"
            : "hidden"
        }
      >
        <video
          ref={remote}
          autoPlay
          playsInline
          className="aspect-video w-full rounded-xl bg-muted"
        />
        <video
          ref={local}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full rounded-xl bg-muted"
        />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {!isCaller && invite.status === "ringing" ? (
          <>
            <Button variant="destructive" onClick={decline}>
              <PhoneOff className="h-4 w-4" /> Decline
            </Button>
            <Button onClick={() => void accept()}>
              <PhoneCall className="h-4 w-4" /> Accept
            </Button>
          </>
        ) : (
          <Button variant="destructive" onClick={hangUp}>
            <PhoneOff className="h-4 w-4" /> Hang up
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Peer-to-peer via the public PeerJS signalling service. Some strict networks may block direct
        connections.
      </p>
    </Panel>
  );
}

function JitsiRoom() {
  const [room, setRoom] = useState<string | null>(null);
  return (
    <Panel className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Group room (Jitsi Meet)</h2>
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
            src={`https://meet.jit.si/${room}`}
            allow="camera; microphone; display-capture; fullscreen"
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
          Opens a private room with a random name on meet.jit.si.
        </p>
      )}
    </Panel>
  );
}
