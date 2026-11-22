export type ClubRsvpStatus = "going" | "maybe" | "cant_make_it";
export type ClubRsvpRecord = { event_id: string; user_id: string; status: ClubRsvpStatus };
export type ClubRsvpCounts = Record<string, { going: number; maybe: number; cant_make_it: number }>;

export function aggregateClubRsvps(rows: ClubRsvpRecord[], userId: string) {
  const counts: ClubRsvpCounts = {};
  const myRsvps: Record<string, ClubRsvpStatus> = {};
  for (const row of rows) {
    counts[row.event_id] ??= { going: 0, maybe: 0, cant_make_it: 0 };
    counts[row.event_id][row.status] += 1;
    if (row.user_id === userId) myRsvps[row.event_id] = row.status;
  }
  return { counts, myRsvps };
}

export type Fixture = { id: string; guildId: string; date: string; time: string };

export function upcoming(guildId: string, list: Fixture[], today: Date): Fixture[] {
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return list
    .filter((fixture) => fixture.guildId === guildId)
    .filter((fixture) => new Date(fixture.date + "T00:00:00").getTime() >= startOfDay.getTime())
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function daysUntilDate(iso: string, today: Date): number {
  const date = new Date(iso + "T00:00:00");
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - startOfDay.getTime()) / 86400000);
}

export function whenLabel(days: number): string {
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : "in " + days + "d";
}

export type ChatMsg = {
  id: string;
  from: "me" | "them" | "club";
  text: string;
  at: string;
  senderName?: string;
  role?: string;
  isAnnouncement?: boolean;
  pinnedAt?: string | null;
};

export function getInitialClubId<T extends { id: string }>(clubs: T[], preferredId: string): string {
  if (clubs.some((club) => club.id === preferredId)) return preferredId;
  return clubs[0]?.id ?? "";
}
