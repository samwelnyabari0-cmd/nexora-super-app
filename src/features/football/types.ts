export type FootballMatchStatus =
  "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";

export type FootballMatch = {
  id: string;
  provider: string;
  providerId: string;
  competitionCode: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: FootballMatchStatus;
  elapsedMinute: number | null;
  kickoffAt: string;
  updatedAt: string;
  sourceUrl: string | null;
};

export type FootballAnnouncement = {
  id: string;
  providerId: string;
  sourceName: string;
  headline: string;
  summary: string;
  sourceUrl: string;
  publishedAt: string;
};

export type FootballHighlight = {
  id: string;
  providerId: string;
  competitionCode: string | null;
  matchLabel: string;
  scoreLabel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  videoUrl: string;
  sourceName: string;
  publishedAt: string;
};
