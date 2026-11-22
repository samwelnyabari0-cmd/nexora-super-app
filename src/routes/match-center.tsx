import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Clock3, ExternalLink, Heart, RefreshCw, Share2, ShieldCheck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { useClubData } from "@/features/clubs/useClubData";
import { useMatchCenter } from "@/features/football/useMatchCenter";
import {
  filterMatchesByCompetition,
  formatMatchStatus,
  isMatchStale,
  type CompetitionFilter,
} from "@/features/football/format";
import type { FootballMatch } from "@/features/football/types";

export const Route = createFileRoute("/match-center")({
  head: () => ({
    meta: [
      { title: "Football Match Center — NEXORA" },
      {
        name: "description",
        content: "Low-data live football scores, news and highlights on Nexora.",
      },
    ],
  }),
  component: MatchCenterPage,
});

const filters: { id: CompetitionFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Live" },
  { id: "EPL", label: "EPL" },
  { id: "UCL", label: "UCL" },
  { id: "LALIGA", label: "La Liga" },
  { id: "FKF", label: "FKF PL" },
];
const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function MatchCenterPage() {
  const data = useMatchCenter();
  const clubs = useClubData("");
  const [filter, setFilter] = useState<CompetitionFilter>("ALL");
  const [liteMode, setLiteMode] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [shareClubId, setShareClubId] = useState("");
  const [syncTeamId, setSyncTeamId] = useState("");
  const [syncClubId, setSyncClubId] = useState("");
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  const matches = useMemo(
    () => filterMatchesByCompetition(data.matches, filter),
    [data.matches, filter],
  );
  const eligibleClubs = clubs.directory.filter((club) => club.my_status === "active");
  const managedClubs = eligibleClubs.filter(
    (club) => club.my_role === "creator" || club.my_role === "admin",
  );
  const managedClubIds = new Set(managedClubs.map((club) => club.id));
  const selectedSyncTeam = data.favorites.find((team) => team.id === syncTeamId);

  const addTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingTeam(true);
    const result = await data.addFavorite(teamName);
    setSavingTeam(false);
    if (result.error) toast.error(result.error);
    else {
      setTeamName("");
      toast.success("Team added to your favorites.");
    }
  };

  const connectTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSyncTeam) return;
    const result = await data.connectTeamToClub(selectedSyncTeam, syncClubId);
    if (result.error) toast.error(result.error);
    else toast.success("Team updates connected to the club.");
  };

  const shareMatch = async (match: FootballMatch) => {
    setBusyMatchId(match.id);
    const result = await data.shareMatchToClub(match, shareClubId);
    setBusyMatchId(null);
    if (result.error) toast.error(result.error);
    else toast.success("Match card shared in your club channel.");
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 pb-10">
      <PageHeader
        title="Football Match Center"
        subtitle="Live scores, football updates and highlights — built for quick, low-data browsing."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {data.lastUpdated
            ? `Cache updated ${new Date(data.lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : "Waiting for first football sync"}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLiteMode((value) => !value)}>
            {liteMode ? "Lite mode on" : "Turn on Lite mode"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void data.refresh()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Match ticker</h2>
          {data.matches.some((match) => isMatchStale(match)) && (
            <span className="text-xs text-amber-600">Some scores may be delayed</span>
          )}
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {data.loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading cached scores…</p>
        ) : matches.length ? (
          <div className="divide-y">
            {matches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                onShare={() => void shareMatch(match)}
                shareDisabled={!shareClubId || busyMatchId === match.id}
                busy={busyMatchId === match.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <WifiOff className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">No matches in this view yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Live scores will appear here when the server-side football provider is connected and
              the cache has been populated.
            </p>
          </div>
        )}
        {data.error && <p className="mt-3 text-xs text-muted-foreground">{data.error}</p>}
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Discuss in Club</h2>
          <Link to="/clubs" className="text-xs text-primary underline">
            Manage clubs
          </Link>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Choose a club where you are an active member, then share a match card into its channel.
        </p>
        <select
          className={input}
          value={shareClubId}
          onChange={(event) => setShareClubId(event.target.value)}
        >
          <option value="">Choose your club</option>
          {eligibleClubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
        {!eligibleClubs.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Join a club first to discuss match updates.
          </p>
        )}
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <Heart className="h-4 w-4" />
          <h2 className="font-semibold">Favorite teams</h2>
        </div>
        <form className="flex gap-2" onSubmit={addTeam}>
          <input
            className={input}
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Add a team, e.g. Arsenal"
            maxLength={60}
          />
          <Button type="submit" disabled={!data.authenticated || savingTeam || !teamName.trim()}>
            {savingTeam ? "Adding…" : "Follow"}
          </Button>
        </form>
        {!data.authenticated && (
          <p className="mt-2 text-xs text-muted-foreground">Sign in to save your favorite teams.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.favorites.map((team) => (
            <span
              key={team.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            >
              {team.team_name}
              <button
                type="button"
                aria-label={`Remove ${team.team_name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void data.removeFavorite(team.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {data.favorites.length > 0 && (
          <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={connectTeam}>
            <select
              className={input}
              value={syncTeamId}
              onChange={(event) => setSyncTeamId(event.target.value)}
            >
              <option value="">Favorite team</option>
              {data.favorites.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name}
                </option>
              ))}
            </select>
            <select
              className={input}
              value={syncClubId}
              onChange={(event) => setSyncClubId(event.target.value)}
            >
              <option value="">Club to receive updates</option>
              {managedClubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={!selectedSyncTeam || !syncClubId}>
              Connect
            </Button>
          </form>
        )}
        {data.clubSyncs.filter((sync) => sync.enabled).length > 0 && (
          <div className="mt-3 space-y-2">
            {data.clubSyncs
              .filter((sync) => sync.enabled)
              .map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    {sync.team_name} →{" "}
                    {clubs.directory.find((club) => club.id === sync.club_id)?.name ?? "Club"}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-destructive underline"
                    onClick={() =>
                      void data.disconnectTeamFromClub(sync.team_provider_id, sync.club_id)
                    }
                  >
                    Turn off
                  </button>
                </div>
              ))}
          </div>
        )}
        {data.favorites.length > 0 && !managedClubs.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Only a club Creator or Admin can enable automatic team updates for that club.
          </p>
        )}
      </Panel>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-semibold">Breaking & transfer news</h2>
          {data.announcements.length ? (
            <div className="space-y-3">
              {data.announcements.map((item) => (
                <a
                  key={item.id}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wide">{item.sourceName}</span>
                    <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold">{item.headline}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Football headlines will appear when a trusted news source is connected.
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="mb-3 font-semibold">Quick highlights</h2>
          {data.highlights.length ? (
            <div className="grid grid-cols-2 gap-3">
              {data.highlights.map((item) => (
                <a
                  key={item.id}
                  href={item.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border"
                >
                  <div className="relative aspect-video bg-muted">
                    {!liteMode && item.thumbnailUrl && (
                      <img
                        src={item.thumbnailUrl}
                        loading="lazy"
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
                      {item.durationSeconds
                        ? `${Math.floor(item.durationSeconds / 60)}:${String(item.durationSeconds % 60).padStart(2, "0")}`
                        : "Watch"}
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-semibold">{item.matchLabel}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {item.scoreLabel ?? item.sourceName}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary">
                      Open highlight <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Official highlight links will appear here. Video is never loaded until you open a
              highlight.
            </p>
          )}
        </Panel>
      </section>
      <div className="flex items-start gap-2 rounded-xl border p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Scores and news are read from Nexora’s server cache. The upstream API key is never sent to
        the browser. No paid data provider is activated until approved.
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/clubs" className="text-xs text-primary underline">
          Clubs & Guilds
        </Link>
        <span className="text-xs text-muted-foreground">·</span>
        <Link to="/live" className="text-xs text-primary underline">
          Nexora LIVE streaming
        </Link>
      </div>
    </main>
  );
}

function MatchRow({
  match,
  onShare,
  shareDisabled,
  busy,
}: {
  match: FootballMatch;
  onShare: () => void;
  shareDisabled: boolean;
  busy: boolean;
}) {
  const live = match.status === "LIVE";
  return (
    <div className="flex min-h-16 items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-[10px] text-muted-foreground">{match.competitionName}</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
          <span className="truncate font-medium">{match.homeTeam}</span>
          <span className="min-w-12 text-center font-bold tabular-nums">
            {match.homeScore ?? "–"} : {match.awayScore ?? "–"}
          </span>
          <span className="truncate text-right font-medium">{match.awayTeam}</span>
        </div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <span
          className={`text-[11px] font-semibold ${live ? "text-red-500" : "text-muted-foreground"}`}
        >
          {formatMatchStatus(match)}
        </span>
        {isMatchStale(match) && <p className="text-[9px] text-amber-600">Delayed</p>}
      </div>
      <Button
        size="icon"
        variant="ghost"
        title="Discuss in Club"
        aria-label={`Discuss ${match.homeTeam} versus ${match.awayTeam} in Club`}
        disabled={shareDisabled}
        onClick={onShare}
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
