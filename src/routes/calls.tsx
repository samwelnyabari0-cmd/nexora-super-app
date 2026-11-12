import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Video, Copy, Search,
  UserPlus, Check, X, Crown, Sparkles, ShieldCheck
} from "lucide-react";
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

  const rawTier = user?.user_metadata?.subscription_tier;
  const hasSyncedPlan =
    rawTier === "free" || rawTier === "pro" || rawTier === "studio";

  const userPlan = hasSyncedPlan ? rawTier : "free";

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

              {user ? (hasSyncedPlan ? planLabel : "Not synced") : "Sign in"}
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
          userPlan === "free" && hasSyncedPlan
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
          {hasSyncedPlan && userPlan === "free" && (
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
          {hasSyncedPlan && userPlan === "pro" ? (
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
          {hasSyncedPlan && userPlan === "studio" ? (
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

      {!hasSyncedPlan && user && (
        <p className="text-xs text-muted-foreground">
          Your subscription status has not been synchronized yet.
          Your existing calling features remain available.
        </p>
      )}

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
        
