// Pure helpers + seed data for Clubs & Guilds. No network, no real payments.
export type GuildKind = "football" | "gaming" | "tech";
export type Guild = {
  id: string;
  name: string;
  kind: GuildKind;
  members: number;
  city: string;
  place: string;
  /** Position of the shared pin on the simulated mini-map (percent). */
  x: number;
  y: number;
  /** Monthly dues pool target in KES (demo). */
  duesTarget: number;
  /** Seeded amount already in the pool (demo). */
  raisedBase: number;
  blurb: string;
};

export const kindLabel: Record<GuildKind, string> = {
  football: "Football club",
  gaming: "Gaming guild",
  tech: "Tech club",
};

export const guilds: Guild[] = [
  {
    id: "g1",
    name: "Nairobi Football Casuals",
    kind: "football",
    members: 48,
    city: "Nairobi",
    place: "Goan Institute Pitch",
    x: 40,
    y: 55,
    duesTarget: 9600,
    raisedBase: 3840,
    blurb: "Sunday-league side. Dues cover pitch hire, ref fees and match-day tickets.",
  },
  {
    id: "g2",
    name: "Machakos Uni Tech Club",
    kind: "tech",
    members: 120,
    city: "Machakos",
    place: "Machakos University Lab 2",
    x: 68,
    y: 30,
    duesTarget: 12000,
    raisedBase: 5200,
    blurb: "Student builders running weekly build nights; the pool funds hackathon prizes.",
  },
  {
    id: "g3",
    name: "GDevelop Game Devs",
    kind: "gaming",
    members: 75,
    city: "Nairobi",
    place: "iHub Co-work",
    x: 12,
    y: 84,
    duesTarget: 7500,
    raisedBase: 3100,
    blurb: "Indie game crews. Monthly dues buy jam prizes and playtest pizza.",
  },
];

export type FixtureKind = "match" | "tournament" | "training" | "meetup" | "jam";
export type Fixture = {
  id: string;
  guildId: string;
  kind: FixtureKind;
  title: string;
  venue: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  time: string;
  /** Seeded RSVP count (demo). */
  rsvpBase: number;
};

export const fixtures: Fixture[] = [
  {
    id: "f1",
    guildId: "g1",
    kind: "match",
    title: "League opener vs Kariobangi United",
    venue: "Goan Institute Pitch",
    date: "2026-10-25",
    time: "15:00",
    rsvpBase: 26,
  },
  {
    id: "f2",
    guildId: "g1",
    kind: "training",
    title: "Midweek training",
    venue: "Goan Institute Pitch",
    date: "2026-11-04",
    time: "18:30",
    rsvpBase: 12,
  },
  {
    id: "f3",
    guildId: "g1",
    kind: "match",
    title: "Sunday league vs Kasarani All-Stars",
    venue: "Goan Institute Pitch",
    date: "2026-11-08",
    time: "15:00",
    rsvpBase: 22,
  },
  {
    id: "f4",
    guildId: "g1",
    kind: "match",
    title: "Cup quarter-final",
    venue: "City Stadium",
    date: "2026-11-22",
    time: "14:00",
    rsvpBase: 30,
  },
  {
    id: "f5",
    guildId: "g2",
    kind: "meetup",
    title: "Weekly build night",
    venue: "Machakos University Lab 2",
    date: "2026-11-05",
    time: "19:00",
    rsvpBase: 35,
  },
  {
    id: "f6",
    guildId: "g2",
    kind: "tournament",
    title: "Hackathon: Machakos Open",
    venue: "Machakos University Auditorium",
    date: "2026-11-14",
    time: "09:00",
    rsvpBase: 60,
  },
  {
    id: "f7",
    guildId: "g2",
    kind: "meetup",
    title: "Intro to GitHub Actions",
    venue: "Machakos University Lab 2",
    date: "2026-10-29",
    time: "19:00",
    rsvpBase: 28,
  },
  {
    id: "f8",
    guildId: "g3",
    kind: "jam",
    title: "48h game jam kickoff",
    venue: "iHub Co-work",
    date: "2026-11-06",
    time: "18:00",
    rsvpBase: 25,
  },
  {
    id: "f9",
    guildId: "g3",
    kind: "meetup",
    title: "Playtest evening",
    venue: "iHub Co-work",
    date: "2026-11-12",
    time: "18:30",
    rsvpBase: 18,
  },
  {
    id: "f10",
    guildId: "g3",
    kind: "jam",
    title: "October jam demo day",
    venue: "iHub Co-work",
    date: "2026-10-24",
    time: "17:00",
    rsvpBase: 31,
  },
];

export type ChatMsg = { id: string; from: "me" | "them"; text: string; at: string };

export const seedChannels: Record<string, ChatMsg[]> = {
  g1: [
    {
      id: "m1",
      from: "them",
      text: "Dues for Sunday's pitch hire — pool is at 40%, chip in if you can.",
      at: "Sat 09:12",
    },
    { id: "m2", from: "them", text: "Line-up for the Kasarani game posts Thursday.", at: "Sat 09:14" },
  ],
  g2: [
    {
      id: "m1",
      from: "them",
      text: "Build night this Wednesday — bring a laptop, we review PRs together.",
      at: "Mon 12:30",
    },
  ],
  g3: [
    {
      id: "m1",
      from: "them",
      text: "Jam theme drops Friday 6pm. Team up in this channel.",
      at: "Sun 20:05",
    },
  ],
};

export type ClubsState = {
  joined: string[];
  rsvps: string[];
  /** guildId -> KES contributed on this device (demo). */
  duesPaid: Record<string, number>;
  /** guildId -> messages this member sent (seeds render first). */
  messages: Record<string, ChatMsg[]>;
};

export const emptyClubs: ClubsState = { joined: [], rsvps: [], duesPaid: {}, messages: {} };

/** Upcoming fixtures for a guild, soonest first. */
export function upcoming(guildId: string, list: Fixture[], today: Date): Fixture[] {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return list
    .filter((f) => f.guildId === guildId)
    .filter((f) => new Date(f.date + "T00:00:00").getTime() >= t.getTime())
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/** Fair monthly share, rounded up to the nearest shilling. */
export function dueShare(target: number, members: number): number {
  if (!(target > 0) || !Number.isInteger(members) || members < 1) return 0;
  return Math.ceil(target / members);
}

/** Pool progress clamped to 0–100. */
export function poolPercent(raised: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((raised / target) * 100)));
}

export function daysUntilDate(iso: string, today: Date): number {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function whenLabel(days: number): string {
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`;
}

/** Coerce unknown stored JSON into a valid ClubsState; unknown ids are dropped. */
export function sanitizeClubs(value: unknown): ClubsState {
  const out: ClubsState = { joined: [], rsvps: [], duesPaid: {}, messages: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const v = value as Partial<ClubsState>;
  const ids = (x: unknown, known: (id: string) => boolean) =>
    Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && known(s)) : [];
  out.joined = ids(v.joined, (id) => guilds.some((g) => g.id === id));
  out.rsvps = ids(v.rsvps, (id) => fixtures.some((f) => f.id === id));
  if (v.duesPaid && typeof v.duesPaid === "object" && !Array.isArray(v.duesPaid)) {
    for (const [k, n] of Object.entries(v.duesPaid)) {
      if (guilds.some((g) => g.id === k) && typeof n === "number" && Number.isFinite(n) && n > 0)
        out.duesPaid[k] = Math.round(n);
    }
  }
  if (v.messages && typeof v.messages === "object" && !Array.isArray(v.messages)) {
    for (const [k, list] of Object.entries(v.messages)) {
      if (!guilds.some((g) => g.id === k) || !Array.isArray(list)) continue;
      out.messages[k] = list.flatMap((m) => {
        const o = m as Partial<ChatMsg> | null;
        return o && typeof o.text === "string" && (o.from === "me" || o.from === "them")
          ? [
              {
                id: String(o.id ?? Math.random().toString(36).slice(2, 10)),
                from: o.from,
                text: o.text,
                at: typeof o.at === "string" ? o.at : "",
              },
            ]
          : [];
      });
    }
  }
  return out;
}
