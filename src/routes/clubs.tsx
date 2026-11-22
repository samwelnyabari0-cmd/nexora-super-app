import { ClubAdminPanel } from "@/components/nexora/ClubAdminPanel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { MapPin, Send, Trophy, Users, CalendarDays, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Avatar, PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { useClubData, type ClubRsvpStatus } from "@/features/clubs/useClubData";
import type { ChatMsg } from "@/features/clubs/logic";
import { useClubRealtime } from "@/features/clubs/useClubRealtime";

export const Route = createFileRoute("/clubs")({
  head: () => ({
    meta: [
      { title: "Clubs & Guilds — NEXORA" },
      {
        name: "description",
        content:
          "Shared memberships, fixtures, event RSVPs, venue maps and club channels.",
      },
      { property: "og:title", content: "Clubs & Guilds — NEXORA" },
      {
        property: "og:description",
        content:
          "Shared memberships, fixtures, event RSVPs and club channels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubsPage,
});

const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function ClubsPage() {
  const [sel, setSel] = useState("g1");
  const data = useClubData(sel);
  const realtime = useClubRealtime(sel);
  const { passport } = useApp();
  const [today, setToday] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [draft, setDraft] = useState({ title: "", kind: "match", venue: "", event_date: "", event_time: "", notes: "" });

  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  useEffect(() => {
    if (data.directory.length && !data.directory.some((club) => club.id === sel)) setSel(data.directory[0].id);
  }, [data.directory, sel]);

  const guild = data.directory.find((club) => club.id === sel) ?? data.directory[0];
  const active = data.membership?.status === "active";
  const canCreateEvents = active && ["creator", "admin", "moderator"].includes(data.membership?.role ?? "");
  const events = data.events.filter((event) => !today || event.event_date >= today);
  const labels: Record<ClubRsvpStatus, string> = { going: "Going", maybe: "Maybe", cant_make_it: "Can't make it" };

  const joinOrLeave = async () => {
    if (!data.authenticated) { toast.error("Sign in to join a club."); return; }
    const result = active ? await data.leaveClub() : await data.requestMembership();
    if (result.error) toast.error(result.error);
    else toast.success(active ? "You left the club." : "Membership request sent for approval.");
  };

  const updateRsvp = async (eventId: string, status: ClubRsvpStatus) => {
    const next = data.myRsvps[eventId] === status ? null : status;
    const result = await data.setRsvp(eventId, next);
    if (result.error) toast.error(result.error);
    else toast.success(next ? "RSVP updated: " + labels[next] : "RSVP removed.");
  };

  const send = async (text: string, isAnnouncement: boolean) => {
    if (!active) { toast.error("Join the club before sending messages."); return; }
    const delivered = await realtime.send(text, isAnnouncement);
    if (!delivered && realtime.error) toast.error(realtime.error);
  };

  const publishEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingEvent(true);
    const result = await data.createEvent(draft);
    setSavingEvent(false);
    if (result.error) { toast.error(result.error); return; }
    setDraft({ title: "", kind: "match", venue: "", event_date: "", event_time: "", notes: "" });
    setShowEventForm(false);
    toast.success("Event added to the shared club calendar.");
  };

  if (!guild && !data.loading) {
    return <div className="mx-auto max-w-5xl"><PageHeader title="Clubs & Guilds" subtitle="Shared club spaces." /><Panel><p className="text-sm text-muted-foreground">{data.error ?? "No clubs available."}</p><Button className="mt-3" variant="outline" onClick={() => void data.refreshDirectory()}>Retry</Button></Panel></div>;
  }
  if (!guild) return <div className="mx-auto max-w-5xl"><PageHeader title="Clubs & Guilds" subtitle="Loading clubs..." /></div>;

  const memberCount = Number(guild.active_member_count ?? 0);
  const status = data.membership?.status;
  const statusLabel = status === "active" ? "Member" : status === "pending" ? "Request pending" : status === "banned" ? "Access restricted" : "Not a member";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Clubs & Guilds" subtitle="Shared memberships, event RSVPs, maps and club channels." />
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {data.directory.map((club) => (
          <button key={club.id} type="button" onClick={() => setSel(club.id)} aria-pressed={club.id === guild.id}
            className={"min-w-0 rounded-2xl border p-3 text-left transition " + (club.id === guild.id ? "border-accent bg-card" : "bg-card/50 hover:bg-card")}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="bg-brand grid h-8 w-8 shrink-0 place-items-center rounded-xl text-primary-foreground"><Trophy className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{club.name}</span><span className="block text-xs capitalize text-muted-foreground">{club.kind} · {club.active_member_count} members</span>{(data.unreadCounts[club.id] ?? 0) > 0 && <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{data.unreadCounts[club.id]} unread</span>}</span>
            </span>
          </button>
        ))}
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold">{guild.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{guild.blurb}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{memberCount} active members · {guild.city}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="rounded-full border px-3 py-1.5 text-xs">{statusLabel}</span>
            <Button className="flex-1 sm:flex-none" variant={active ? "outline" : "default"} onClick={() => void joinOrLeave()} disabled={status === "pending" || status === "banned" || (active && data.membership?.role === "creator")}>
              {active ? "Leave club" : status === "pending" ? "Awaiting approval" : status === "banned" ? "Access restricted" : "Request to join"}
            </Button>
          </div>
        </div>
        {data.error && <p className="mt-3 text-xs text-destructive">{data.error}</p>}
        {status === "pending" && <p className="mt-2 text-xs text-muted-foreground">Your request is saved to Supabase and awaits approval.</p>}
        {!data.authenticated && <p className="mt-2 text-xs text-muted-foreground">Sign in to join, RSVP and post in the club channel.</p>}
      </Panel>

      {data.authenticated && <ClubAdminPanel clubId={guild.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-display font-semibold">Shared venue</h3><span className="text-xs text-muted-foreground">Club location</span></div>
          <div className="overflow-hidden rounded-xl border bg-muted"><div className="aspect-[4/3]"><iframe title={"Map for " + guild.name} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={"https://www.google.com/maps?q=" + encodeURIComponent(guild.venue + ", " + guild.city) + "&output=embed"} /></div></div>
          <p className="mt-3 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-accent" /><span className="min-w-0 break-words">{guild.venue} · {guild.city}</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium hover:bg-muted" href={"https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(guild.venue + ", " + guild.city)} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Get directions</a>
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(guild.venue + ", " + guild.city).then(() => toast.success("Venue copied.")); }}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy venue</Button>
            <Button asChild size="sm" variant="outline"><Link to="/maps" search={{ q: undefined }}>Open Maps</Link></Button>
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-display font-semibold">Club information</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs">Shared</span></div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Active members</span><strong>{memberCount}</strong></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Upcoming events</span><strong>{events.length}</strong></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Your membership</span><strong>{statusLabel}</strong></div>
            <p className="border-t pt-3 text-xs text-muted-foreground">Membership and RSVPs are stored in Supabase. Payments and dues collection are disabled for now.</p>
          </div>
        </Panel>

        <Panel className="md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-display font-semibold">Fixtures & events</h3><p className="text-xs text-muted-foreground">Shared calendar and member responses</p></div>
            {canCreateEvents && <Button size="sm" onClick={() => setShowEventForm((value) => !value)}><CalendarDays className="mr-1.5 h-4 w-4" />{showEventForm ? "Close" : "Add event"}</Button>}
          </div>
          {showEventForm && canCreateEvents && (
            <form className="mb-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2" onSubmit={publishEvent}>
              <input className={input} placeholder="Event title" value={draft.title} onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} required />
              <select className={input} value={draft.kind} onChange={(e) => setDraft((v) => ({ ...v, kind: e.target.value }))}>{["match","tournament","training","meetup","jam"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select>
              <input className={input} placeholder="Venue / pitch" value={draft.venue} onChange={(e) => setDraft((v) => ({ ...v, venue: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-2"><input className={input} type="date" min={today || undefined} value={draft.event_date} onChange={(e) => setDraft((v) => ({ ...v, event_date: e.target.value }))} required /><input className={input} type="time" value={draft.event_time} onChange={(e) => setDraft((v) => ({ ...v, event_time: e.target.value }))} required /></div>
              <textarea className={input + " sm:col-span-2"} placeholder="Notes (optional)" rows={2} value={draft.notes} onChange={(e) => setDraft((v) => ({ ...v, notes: e.target.value }))} />
              <Button type="submit" className="sm:col-span-2" disabled={savingEvent || !draft.title.trim() || !draft.venue.trim() || !draft.event_date || !draft.event_time}>{savingEvent ? "Saving..." : "Publish event"}</Button>
            </form>
          )}
          {data.loading ? <p className="py-4 text-sm text-muted-foreground">Loading shared events...</p> : events.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {events.map((event) => {
                const mine = data.myRsvps[event.id];
                const counts = data.rsvpCounts[event.id] ?? { going: 0, maybe: 0, cant_make_it: 0 };
                const dateLabel = new Date(event.event_date + "T" + event.event_time + ":00").toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
                return <li key={event.id} className="min-w-0 rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold">{event.title}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{event.kind} · {event.venue}</p></div>
                    <a className="shrink-0 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted" href={"https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(event.title) + "&location=" + encodeURIComponent(event.venue) + "&dates=" + event.event_date.replaceAll("-", "") + "T" + event.event_time.replace(":", "") + "00/" + event.event_date.replaceAll("-", "") + "T" + event.event_time.replace(":", "") + "00"} target="_blank" rel="noreferrer">Calendar</a>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{dateLabel}</p>
                  {event.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{event.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">{(Object.keys(labels) as ClubRsvpStatus[]).map((status) => <Button key={status} size="sm" variant={mine === status ? "default" : "outline"} disabled={!active} onClick={() => void updateRsvp(event.id, status)}>{labels[status]}{mine === status ? " ✓" : ""}</Button>)}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{counts.going} going · {counts.maybe} maybe · {counts.cant_make_it} can't make it</p>
                </li>;
              })}
            </ul>
          ) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No upcoming events yet.</p>}
          {!active && <p className="mt-2 text-xs text-muted-foreground">Join this club and get approved to RSVP.</p>}
        </Panel>

        <Panel className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-display font-semibold">Club channel</h3><p className="text-xs text-muted-foreground">Messages update across club members</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{active ? "Realtime" : "Members only"}</span></div>
          <Channel guildId={guild.id} msgs={realtime.messages} onSend={send} name={passport.name} disabled={!active} canManage={canCreateEvents} onPin={realtime.pinMessage} />
          {realtime.error && <p className="mt-2 text-xs text-destructive">{realtime.error}</p>}
        </Panel>
      </div>
    </div>
  );
}

function Channel({
  guildId,
  msgs,
  onSend,
  name,
  disabled,
  canManage,
  onPin,
}: {
  guildId: string;
  msgs: ChatMsg[];
  onSend: (text: string, isAnnouncement: boolean) => void;
  name: string;
  disabled: boolean;
  canManage: boolean;
  onPin: (messageId: string, pinned: boolean) => Promise<boolean>;
}) {
  const [t, setT] = useState("");
  const [announcement, setAnnouncement] = useState(false);
  const submit = () => {
    if (!t.trim()) return;
    onSend(t.trim(), announcement && canManage);
    setT("");
  };
  return (
    <>
      <div
        className="max-h-64 space-y-2 overflow-y-auto"
        aria-label={`${guildId} channel messages`}
      >
        {msgs.length ? msgs.map((m) => (
          <Bubble key={m.id} m={m} name={name} canManage={canManage} onPin={onPin} />
        )) : (
          <p className="py-4 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        )}
      </div>
      {canManage && (
        <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} />
          Post as announcement
        </label>
      )}
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
          placeholder={disabled ? "Join the club to send messages" : "Message the club..."}
          disabled={disabled}
          className={input}
        />
        <Button type="submit" disabled={disabled || !t.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

function Bubble({ m, name, canManage, onPin }: { m: ChatMsg; name: string; canManage: boolean; onPin: (messageId: string, pinned: boolean) => Promise<boolean> }) {
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
        {m.isAnnouncement && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-accent">Announcement</p>}
        {!mine && (
          <p className="mb-1 text-[11px] font-semibold">
            {m.senderName || "Club member"}
            {m.role && m.role !== "member" && <span className="ml-1 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] capitalize">{m.role}</span>}
          </p>
        )}
        <p className="break-words">{m.text}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          {canManage && <button type="button" className="text-[10px] underline" onClick={() => void onPin(m.id, !m.pinnedAt)}>{m.pinnedAt ? "Unpin" : "Pin"}</button>}
          <p className={`ml-auto text-right text-[11px] ${mine ? "opacity-75" : "text-muted-foreground"}`}>
            {m.pinnedAt ? "Pinned · " : ""}{m.at}
          </p>
        </div>
      </div>
    </div>
  );
}
