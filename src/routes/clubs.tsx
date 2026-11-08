import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, MessagesSquare, Send, Trophy, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Avatar, DemoBadge, PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { fmtKES } from "@/features/core/data";
import { useApp } from "@/features/core/store";
import {
  daysUntilDate,
  dueShare,
  fixtures,
  guilds,
  kindLabel,
  poolPercent,
  seedChannels,
  upcoming,
  whenLabel,
  type ChatMsg,
  type Guild,
} from "@/features/clubs/logic";
import { clubMsgId, useClubs } from "@/features/clubs/useClubs";
import { useClubRealtime } from "@/features/clubs/useClubRealtime";
import { PaystackTopUp } from "@/components/nexora/PaystackTopUp";

export const Route = createFileRoute("/clubs")({
  head: () => ({
    meta: [
      { title: "Clubs & Guilds — NEXORA" },
      {
        name: "description",
        content:
          "Group spaces for football clubs, gaming guilds and tech clubs: shared pin, fixtures, dues pool and a club channel. Saved on your device.",
      },
      { property: "og:title", content: "Clubs & Guilds — NEXORA" },
      {
        property: "og:description",
        content:
          "Fixtures, dues pools and club channels for local football, gaming and tech crews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubsPage,
});

const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function ClubsPage() {
  const { state, update } = useClubs();
  const { passport } = useApp();
  const [sel, setSel] = useState(guilds[0].id);
  const realtime = useClubRealtime(sel);
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const guild = guilds.find((g) => g.id === sel) ?? guilds[0];
  const joined = state.joined.includes(guild.id);
  const raised = guild.raisedBase + (state.duesPaid[guild.id] ?? 0);
  const share = dueShare(guild.duesTarget, guild.members);
  const pct = poolPercent(raised, guild.duesTarget);
  const list = today
    ? upcoming(guild.id, fixtures, today)
    : fixtures.filter((f) => f.guildId === guild.id);
  const msgs: ChatMsg[] = realtime.authenticated
    ? realtime.messages
    : [...(seedChannels[guild.id] ?? []), ...(state.messages[guild.id] ?? [])];

  const toggleJoin = () =>
    update((s) => ({
      ...s,
      joined: s.joined.includes(guild.id)
        ? s.joined.filter((x) => x !== guild.id)
        : [...s.joined, guild.id],
    }));

  const rsvp = (fid: string) =>
    update((s) => ({
      ...s,
      rsvps: s.rsvps.includes(fid) ? s.rsvps.filter((x) => x !== fid) : [...s.rsvps, fid],
    }));

  const addDues = () => {
    update((s) => ({
      ...s,
      duesPaid: { ...s.duesPaid, [guild.id]: (s.duesPaid[guild.id] ?? 0) + share },
    }));
    toast.success(`Recorded ${fmtKES(share)} in the ${guild.name} pool (demo — no money moved)`);
  };

  const send = async (text: string) => {
    if (realtime.authenticated) {
      const delivered = await realtime.send(text, passport.name);
      if (!delivered && realtime.error) toast.error(realtime.error);
      return;
    }
    update((s) => ({
      ...s,
      messages: {
        ...s.messages,
        [guild.id]: [...(s.messages[guild.id] ?? []), { id: clubMsgId(), from: "me", text, at: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) }],
      },
    }));
    toast.error("Sign in to deliver messages to the club.");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Clubs & Guilds"
        subtitle="Group spaces for football clubs, gaming guilds and tech clubs — a shared pin, fixtures, a dues pool and a club channel."
        action={<DemoBadge>{realtime.authenticated ? "Supabase connected" : "Sign in required"}</DemoBadge>}
      />

      {/* Guild switcher */}
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {guilds.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSel(g.id)}
            aria-pressed={g.id === guild.id}
            className={`rounded-2xl border p-3 text-left transition ${
              g.id === guild.id ? "border-accent bg-card" : "bg-card/50 hover:bg-card"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="bg-brand grid h-8 w-8 place-items-center rounded-xl text-primary-foreground">
                <Trophy className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{g.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {kindLabel[g.kind]} · {g.members} members
                </span>
              </span>
            </span>
            {state.joined.includes(g.id) && (
              <span className="mt-2 inline-block rounded-full bg-success/15 px-2 text-[11px] font-semibold text-success">
                Joined
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Guild header */}
      <Panel className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold">{guild.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{guild.blurb}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {guild.members} members · {guild.city}
            </p>
          </div>
          <Button variant={joined ? "outline" : "default"} onClick={toggleJoin}>
            {joined ? "Leave guild" : "Join guild"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Membership saves on this device only — shared accounts are not connected yet.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Shared pin */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Shared pin</h3>
            <DemoBadge>Google Maps</DemoBadge>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
            <iframe
              title={`Google Maps location for ${guild.name}`}
              className="h-full w-full border-0"
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/search?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""}&q=${encodeURIComponent(`${guild.place}, ${guild.city}`)}`}
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-accent" /> {guild.place} · {guild.city}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/maps" search={{ q: undefined }}>
              Open Maps
            </Link>
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Pin preview only — live maps aren't connected.
          </p>
        </Panel>

        {/* Group wallet pool */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Group wallet pool</h3>
            <DemoBadge>No real money</DemoBadge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xl font-bold">{fmtKES(raised)}</p>
              <p className="text-muted-foreground">raised</p>
            </div>
            <div>
              <p className="text-xl font-bold">{fmtKES(guild.duesTarget)}</p>
              <p className="text-muted-foreground">target</p>
            </div>
            <div>
              <p className="text-xl font-bold">{pct}%</p>
              <p className="text-muted-foreground">funded</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-accent" /> Your share: {fmtKES(share)} / month across{" "}
            {guild.members} members
          </p>
          <div className="mt-3">
            <PaystackTopUp />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dues are collected through the Paystack checkout. A verified webhook should mark the club ledger paid.
          </p>
        </Panel>

        {/* Fixtures & events */}
        <Panel className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Fixtures & events</h3>
            <DemoBadge>Device calendar</DemoBadge>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {list.map((f) => {
              const days = today ? daysUntilDate(f.date, today) : 0;
              const going = state.rsvps.includes(f.id);
              const base = fixtures.find((x) => x.id === f.id)?.rsvpBase ?? 0;
              return (
                <li key={f.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{f.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.venue} · {f.kind}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={going ? "default" : "outline"}
                        aria-pressed={going}
                        onClick={() => rsvp(f.id)}
                      >
                        {going ? "Going ✓" : "RSVP"}
                      </Button>
                      <a
                        className="inline-flex items-center rounded-md border px-2 text-xs hover:bg-muted"
                        href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(f.title)}&location=${encodeURIComponent(`${f.venue}, ${guild.city}`)}&dates=${f.date.replaceAll("-", "")}T${f.time.replace(":", "")}00/${f.date.replaceAll("-", "")}T${f.time.replace(":", "")}00`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Calendar
                      </a>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {today ? whenLabel(days) : f.date} · {f.date} at {f.time} ·{" "}
                    <span className={today !== null && days <= 3 ? "text-warning" : ""}>
                      {base + (going ? 1 : 0)} going
                    </span>
                  </p>
                </li>
              );
            })}
            {!list.length && (
              <li className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No upcoming events.
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            RSVPs save on this device only — a shared club calendar needs accounts.
          </p>
        </Panel>

        {/* Club channel */}
        <Panel className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">Club channel</h3>
            <DemoBadge>{realtime.authenticated ? "Realtime" : "Sign in to chat"}</DemoBadge>
          </div>
          <Channel guildId={guild.id} msgs={msgs} onSend={send} name={passport.name} />
          <p className="mt-2 text-xs text-muted-foreground">
            {realtime.authenticated ? "Messages deliver through Supabase Realtime." : "Sign in to deliver messages across devices."}
          </p>
        </Panel>
      </div>

      <Panel className="mt-4 text-sm text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">Club services</p>
        {realtime.authenticated
          ? "Supabase Realtime delivers messages, Google Maps shows the club pin, Google Calendar links add fixtures, and Paystack handles dues checkout."
          : "Sign in to activate shared messages and account-backed club actions. Maps and calendar links remain available while browsing."}
      </Panel>
    </div>
  );
}

function Channel({
  guildId,
  msgs,
  onSend,
  name,
}: {
  guildId: string;
  msgs: ChatMsg[];
  onSend: (text: string) => void;
  name: string;
}) {
  const [t, setT] = useState("");
  const submit = () => {
    if (!t.trim()) return;
    onSend(t.trim());
    setT("");
  };
  return (
    <>
      <div
        className="max-h-64 space-y-2 overflow-y-auto"
        aria-label={`${guildId} channel messages`}
      >
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} name={name} />
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label="Message the club channel"
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder={`Message ${guildId.toUpperCase()}…`}
          className={input}
        />
        <Button type="submit" disabled={!t.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

function Bubble({ m, name }: { m: ChatMsg; name: string }) {
  const mine = m.from === "me";
  return (
    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      {mine ? (
        <Avatar name={name} size={24} />
      ) : (
        <span className="bg-muted grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold">
          C
        </span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          mine ? "bg-brand text-primary-foreground" : "bg-muted"
        }`}
      >
        <p>{m.text}</p>
        <p className={`text-right text-[11px] ${mine ? "opacity-75" : "text-muted-foreground"}`}>
          {m.at} · demo
        </p>
      </div>
    </div>
  );
}
