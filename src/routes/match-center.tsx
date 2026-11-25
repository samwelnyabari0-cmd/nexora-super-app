import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bell, BellOff, Clock3, ExternalLink, Gamepad2, Heart, Radio, RefreshCw, Share2, ShieldCheck, Swords, Target, Trophy, Users, Volume2, WifiOff, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { useClubData } from "@/features/clubs/useClubData";
import { useMatchCenter } from "@/features/football/useMatchCenter";
import { ArenaFixturesTables } from "@/features/football/ArenaFixturesTables";
import {
  filterMatchesByCompetition,
  formatMatchStatus,
  isMatchStale,
  type CompetitionFilter,
} from "@/features/football/format";
import type { FootballMatch } from "@/features/football/types";
import { ConnectedGames } from "@/features/arena/ConnectedGames";
import { ArenaTournamentHub } from "@/features/arena/ArenaTournamentHub";

export const Route = createFileRoute("/match-center")({
  head: () => ({
    meta: [
      { title: "Nexora Arena — NEXORA" },
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
  const [activeMode, setActiveMode] = useState<"football" | "gaming" | "cups">("football");

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
  const liveMatch = data.matches.find((match) => match.status === "LIVE");

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
    else toast.success("Team updates connected to the squad.");
  };

  const shareMatch = async (match: FootballMatch) => {
    setBusyMatchId(match.id);
    const result = await data.shareMatchToClub(match, shareClubId);
    setBusyMatchId(null);
    if (result.error) toast.error(result.error);
    else toast.success("Match card shared in your squad channel.");
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 pb-10">
      <PageHeader
        title="Nexora Arena"
        subtitle="Football, gaming and fan competition — one fast, low-data space."
      />
      <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-1.5">
        {([
          { id: "football", label: "Football", icon: Trophy },
          { id: "gaming", label: "Instant play", icon: Gamepad2 },
          { id: "cups", label: "Cups", icon: Swords },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveMode(id)} aria-pressed={activeMode === id}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-colors motion-reduce:transition-none sm:gap-2 sm:text-sm ${activeMode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
            <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {activeMode === "football" ? (
        <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {data.lastUpdated
            ? `Cache updated ${new Date(data.lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : "Waiting for first football sync"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => data.setGoalAlertsEnabled(!data.goalAlertsEnabled)}
            aria-pressed={data.goalAlertsEnabled}
          >
            {data.goalAlertsEnabled ? <Bell className="mr-1 h-3.5 w-3.5" /> : <BellOff className="mr-1 h-3.5 w-3.5" />}
            {data.goalAlertsEnabled ? "Goal alerts on" : "Goal alerts off"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLiteMode((value) => !value)}>
            {liteMode ? "Lite mode on" : "Turn on Lite mode"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void data.refresh()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {data.goalAlertsEnabled
          ? "Goal alerts are enabled on this device while Nexora Arena is open. Alerts use the available live-score feed and may be delayed or unavailable for some competitions."
          : "Turn on goal alerts to see a notification when a live match score increases. This free version only checks while Nexora Arena is open."}
      </p>

      <Panel>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><h2 className="flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-red-500" /> Matchday pulse</h2><p className="text-xs text-muted-foreground">Swipe through live and upcoming fixtures</p></div>
          <span className="shrink-0 rounded-full border px-2 py-1 text-[10px] text-muted-foreground">{data.matches.filter((match) => match.status === "LIVE").length} live</span>
        </div>
        {data.matches.length ? <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
          {data.matches.slice(0, 8).map((match) => <article key={match.id} className="w-[min(78vw,250px)] shrink-0 snap-start rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span className="truncate">{match.competitionName}</span><span className={match.status === "LIVE" ? "shrink-0 font-bold text-red-500" : "shrink-0"}>{formatMatchStatus(match)}</span></p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-semibold"><span className="truncate">{match.homeTeam}</span><span className="tabular-nums">{match.homeScore ?? "–"} : {match.awayScore ?? "–"}</span><span className="truncate text-right">{match.awayTeam}</span></div>
            <p className="mt-2 text-[10px] text-muted-foreground">{isMatchStale(match) ? "Score update may be delayed" : "Cached match update"}</p>
          </article>)}
        </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No verified fixtures are available yet. Match cards appear when the football data cache is populated.</p>}
      </Panel>

      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Match ticker</h2>
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
              Live scores appear here when SportScore publishes active matches. Saved match data
              remains available if the live feed is temporarily unavailable.
            </p>
          </div>
        )}
        {data.error && <p className="mt-3 text-xs text-muted-foreground">{data.error}</p>}
      </Panel>

      <ArenaFixturesTables />

      <Panel>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Squad discussion</h2>
          <Link to="/clubs" className="text-xs text-primary underline">
            Manage squads
          </Link>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Choose a squad you belong to and share a match card in its discussion channel.
        </p>
        <select
          className={input}
          value={shareClubId}
          onChange={(event) => setShareClubId(event.target.value)}
        >
          <option value="">Choose a squad</option>
          {eligibleClubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
        {!eligibleClubs.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Join a squad first to discuss match updates.
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
              <option value="">Squad to receive updates</option>
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
                    {clubs.directory.find((club) => club.id === sync.club_id)?.name ?? "Squad"}
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
            Only a squad Creator or Admin can enable automatic team updates.
          </p>
        )}
      </Panel>

      <section className="grid gap-3 md:grid-cols-2">
        <Panel><ArenaFanPoll match={liveMatch} /></Panel>
        <Panel>
          <div className="mb-2 flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Audio watch-along</h2></div>
          <p className="text-sm text-muted-foreground">Bring your squad together for commentary and match reactions. Use the existing group room and keep your camera off if you only want audio.</p>
          <Link to="/calls" search={{ arenaAudio: true }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-muted"><Radio className="h-4 w-4" /> Open group room</Link>
          <p className="mt-2 text-[10px] text-muted-foreground">Group rooms are hosted through Jitsi Meet.</p>
        </Panel>
      </section>

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
                  {item.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>}
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
      <div className="flex flex-col gap-2 rounded-xl border p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Live scores load from SportScore’s public feed in your browser. Nexora’s saved match cache remains as a fallback when the provider is unavailable.</span>
        </div>
        {data.matches.some((match) => match.provider === "sportscore") && (
          <a
            href="https://sportscore.com/"
            target="_blank"
            rel="dofollow"
            title="Sports data by SportScore"
            className="shrink-0 font-semibold text-primary underline underline-offset-2"
          >
            Powered by SportScore
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/clubs" className="text-xs text-primary underline">
          Squads & Communities
        </Link>
        <span className="text-xs text-muted-foreground">·</span>
        <Link to="/live" className="text-xs text-primary underline">
          Nexora LIVE streaming
        </Link>
      </div>
        </>
      ) : activeMode === "gaming" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Zap className="h-5 w-5" /></div><div className="min-w-0"><h2 className="font-display text-lg font-bold">Play instantly</h2><p className="mt-1 text-sm text-muted-foreground">Lightweight games run right here — no app-store download or heavy 3D assets.</p></div></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2"><Panel><FreeKickChallenge /></Panel><Panel><PenaltyShootout /></Panel><Panel><ArenaTrivia /></Panel></div>
          <Panel><ConnectedGames /></Panel>
          <Panel><div className="flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="font-semibold">Challenge your squad</h2></div><p className="mt-2 text-sm text-muted-foreground">Finish a run, share your score link in a Nexora conversation, and invite friends to beat it.</p><Link to="/messages" className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-muted"><Swords className="h-4 w-4" /> Open messages</Link></Panel>
        </section>
      ) : (
        <ArenaTournamentHub />
      )}
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

      </div>
      <Button
        size="icon"
        variant="ghost"
        title="Discuss in Squad"
        aria-label={`Discuss ${match.homeTeam} versus ${match.awayTeam} in Squad`}
        disabled={shareDisabled}
        onClick={onShare}
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}


function PenaltyShootout() {
  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [saves, setSaves] = useState(0);
  const [message, setMessage] = useState("Pick a corner and take your first shot.");
  const [finished, setFinished] = useState(false);
  const challengeValue = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("beat");
  const challengeTarget = challengeValue === null ? null : Number(challengeValue);
  const validTarget = challengeTarget !== null && Number.isFinite(challengeTarget) && challengeTarget >= 0 ? challengeTarget : null;
  const shoot = (direction: string) => {
    if (finished) return;
    const keeper = ["Left", "Center", "Right"][Math.floor(Math.random() * 3)];
    const scored = keeper !== direction;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (scored) setGoals((value) => value + 1); else setSaves((value) => value + 1);
    setMessage(scored ? "GOAL! You beat the keeper." : "Saved! The keeper read your shot.");
    if (nextAttempts >= 5) setFinished(true);
  };
  const challenge = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("beat", String(goals));
    const shareText = "Can you beat my Nexora Arena penalty score of " + goals + "/5? " + url.toString();
    if (navigator.share) await navigator.share({ title: "Beat my Arena score", text: shareText, url: url.toString() });
    else { await navigator.clipboard.writeText(shareText); setMessage("Challenge link copied. Share it with your squad!"); }
  };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Gamepad2 className="h-4 w-4 text-primary" /> Penalty shootout</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">5 shots</span></div>
    <div className="rounded-xl border bg-muted/40 p-3 text-center"><div className="mx-auto mb-2 grid h-20 max-w-52 grid-cols-3 items-end gap-1 rounded-t-[3rem] border-2 border-b-0 border-foreground/30 px-2 pt-4">{["Left","Center","Right"].map((side) => <div key={side} className="grid h-12 place-items-center rounded-t-lg bg-emerald-500/20 text-[10px] font-bold text-emerald-700">{side === "Center" ? "🥅" : "⚽"}</div>)}</div><p className="text-sm font-semibold">{message}</p><p className="mt-1 text-xs tabular-nums text-muted-foreground">Goals {goals} · Saves {saves} · Shots {attempts}/5</p>{validTarget !== null && <p className="mt-1 text-xs font-semibold text-primary">Challenge: beat {validTarget}/5</p>}</div>
    <div className="grid grid-cols-3 gap-2">{["Left","Center","Right"].map((side) => <Button key={side} variant="outline" size="sm" disabled={finished} onClick={() => shoot(side)}>{side}</Button>)}</div>
    {finished ? <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void challenge()}>Challenge squad</Button><Button size="sm" variant="outline" onClick={() => { setAttempts(0); setGoals(0); setSaves(0); setFinished(false); setMessage("New round. Pick a corner."); }}>Play again</Button></div> : <p className="text-[10px] text-muted-foreground">No downloads. Simple graphics and motion keep the game lightweight.</p>}
  </div>;
}


function FreeKickChallenge() {
  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [aim, setAim] = useState("Top left");
  const [power, setPower] = useState(68);
  const [curve, setCurve] = useState(35);
  const [message, setMessage] = useState("Set your aim, power and curve — then shoot.");
  const [finished, setFinished] = useState(false);
  const [lastShot, setLastShot] = useState<"goal" | "saved" | "wide" | null>(null);
  const [best, setBest] = useState(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("nexora-arena-free-kick-best") || 0);
    if (Number.isFinite(stored)) setBest(stored);
  }, []);

  const shoot = () => {
    if (finished || attempts >= 5) return;
    const keeper = ["Top left", "Top center", "Top right", "Bottom left", "Bottom center", "Bottom right"][Math.floor(Math.random() * 6)];
    const accuracy = Math.max(0.72, 1 - Math.max(0, power - 78) * 0.009 - Math.abs(curve - 45) * 0.002);
    const wide = Math.random() > accuracy;
    const scored = !wide && keeper !== aim;
    const nextAttempts = attempts + 1;
    const nextGoals = goals + (scored ? 1 : 0);
    setAttempts(nextAttempts);
    if (scored) setGoals(nextGoals);
    setLastShot(wide ? "wide" : scored ? "goal" : "saved");
    setMessage(wide ? "Just wide! Try a little less power." : scored ? "WHAT A STRIKE! GOAL!" : "The keeper got a hand to it. Change your target!");
    if (nextAttempts === 5) {
      setFinished(true);
      if (nextGoals > best) {
        setBest(nextGoals);
        window.localStorage.setItem("nexora-arena-free-kick-best", String(nextGoals));
      }
    }
  };

  const reset = () => {
    setAttempts(0); setGoals(0); setFinished(false); setLastShot(null);
    setAim("Top left"); setPower(68); setCurve(35);
    setMessage("New set. Pick your target and take the free kick.");
  };

  const share = async () => {
    const text = "I scored " + goals + "/5 in Nexora Arena Free Kick Challenge. Can you beat me?";
    try {
      if (navigator.share) await navigator.share({ title: "Nexora Free Kick Challenge", text });
      else { await navigator.clipboard.writeText(text); setMessage("Score copied — share it with your squad!"); }
    } catch { /* The player may close the share sheet. */ }
  };

  const targets = ["Top left", "Top center", "Top right", "Bottom left", "Bottom center", "Bottom right"];
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-primary" /> Free Kick Challenge</h2>
      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">5 kicks</span>
    </div>
    <div className="rounded-xl border bg-gradient-to-b from-emerald-900/10 to-muted/40 p-3">
      <div className="relative mx-auto max-w-xs rounded-t-[3.5rem] border-[5px] border-b-0 border-foreground/50 bg-emerald-600/10 p-2 pb-0">
        <div className="grid grid-cols-3 grid-rows-2 gap-1">
          {targets.map((target) => <button key={target} type="button" aria-label={"Aim " + target} aria-pressed={aim === target} disabled={finished} onClick={() => setAim(target)} className={"grid aspect-[1.55] place-items-center rounded-md border text-[10px] font-bold transition " + (aim === target ? "border-primary bg-primary/25 text-primary ring-2 ring-primary/40" : "border-foreground/15 bg-background/50 hover:bg-primary/10")}>
            {aim === target ? "⚽" : "＋"}
          </button>)}
        </div>
      </div>
      <div className="mx-auto mt-2 h-1 max-w-xs rounded-full bg-foreground/20" />
      <p className="mt-3 min-h-10 text-center text-sm font-semibold" aria-live="polite">{message}</p>
      {lastShot && <p className={"text-center text-xs font-bold " + (lastShot === "goal" ? "text-emerald-600" : lastShot === "saved" ? "text-amber-600" : "text-muted-foreground")}>{lastShot === "goal" ? "GOAL" : lastShot === "saved" ? "SAVED BY THE KEEPER" : "OFF TARGET"}</p>}
      <p className="mt-2 text-center text-xs tabular-nums text-muted-foreground">Goals {goals} · Kicks {attempts}/5 · Personal best {best}/5</p>
    </div>
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-xs"><label htmlFor="free-kick-power" className="font-medium">Shot power</label><span className="tabular-nums text-muted-foreground">{power}%</span></div>
        <input id="free-kick-power" aria-label="Shot power" type="range" min="25" max="100" value={power} disabled={finished} onChange={(event) => setPower(Number(event.target.value))} className="w-full accent-primary" />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs"><label htmlFor="free-kick-curve" className="font-medium">Ball curve</label><span className="tabular-nums text-muted-foreground">{curve}%</span></div>
        <input id="free-kick-curve" aria-label="Ball curve" type="range" min="0" max="100" value={curve} disabled={finished} onChange={(event) => setCurve(Number(event.target.value))} className="w-full accent-primary" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => setAim("Top left")} disabled={finished}>Left</Button>
        <Button variant="outline" size="sm" onClick={() => setAim("Top center")} disabled={finished}>Center</Button>
        <Button variant="outline" size="sm" onClick={() => setAim("Top right")} disabled={finished}>Right</Button>
      </div>
      {finished ? <div className="flex gap-2"><Button className="flex-1" size="sm" onClick={reset}>Play again</Button><Button className="flex-1" size="sm" variant="outline" onClick={() => void share()}><Share2 className="mr-1 h-3.5 w-3.5" /> Challenge</Button></div> : <Button className="w-full" onClick={shoot}><Zap className="mr-2 h-4 w-4" /> Take the free kick</Button>}
      <p className="text-[10px] text-muted-foreground">Tip: high power can reduce accuracy. Aim away from the keeper and find your perfect curve.</p>
    </div>
  </div>;
}

function ArenaTrivia() {
  const questions = [
    { q: "How many players start on the pitch for one football team?", a: ["9", "10", "11"], correct: "11" },
    { q: "What is the duration of a standard half in senior football?", a: ["35 minutes", "45 minutes", "50 minutes"], correct: "45 minutes" },
    { q: "Which card means a player is sent off?", a: ["Yellow", "Red", "Blue"], correct: "Red" },
  ];
  const [index, setIndex] = useState(0); const [points, setPoints] = useState(0); const [picked, setPicked] = useState(""); const [done, setDone] = useState(false);
  const current = questions[index];
  const answer = (value: string) => { if (picked || done) return; setPicked(value); if (value === current.correct) setPoints((score) => score + 1); };
  const next = () => { if (index === questions.length - 1) setDone(true); else { setIndex((value) => value + 1); setPicked(""); } };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4 text-amber-500" /> 60-second trivia</h2><span className="text-[10px] text-muted-foreground">{Math.min(index + 1, questions.length)}/{questions.length}</span></div>
    {done ? <div className="rounded-xl bg-muted/40 p-4 text-center"><p className="text-2xl font-bold tabular-nums">{points}/{questions.length}</p><p className="text-sm text-muted-foreground">Correct answers</p><Button size="sm" className="mt-3" onClick={() => { setIndex(0); setPoints(0); setPicked(""); setDone(false); }}>Play again</Button></div> : <><p className="text-sm font-medium">{current.q}</p><div className="grid gap-2">{current.a.map((option) => <button key={option} type="button" disabled={!!picked} onClick={() => answer(option)} className={`rounded-xl border px-3 py-2 text-left text-sm ${picked === option ? option === current.correct ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10" : "hover:bg-muted"}`}>{option}</button>)}</div>{picked && <Button size="sm" className="w-full" onClick={next}>{index === questions.length - 1 ? "Finish quiz" : "Next question"}</Button>}</>}
  </div>;
}

const ARENA_POLL_CHOICES = ["Home", "Away", "No more goals"] as const;

function ArenaFanPoll({ match }: { match?: FootballMatch }) {
  const [choice, setChoice] = useState("");
  const [voted, setVoted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({ Home: 0, Away: 0, "No more goals": 0 });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!match) return;
    setChoice("");
    setVoted(false);
    setCounts({ Home: 0, Away: 0, "No more goals": 0 });
    const channel = supabase.channel("arena-fan-poll-" + match.id, { config: { private: true } });
    channel
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        const incoming = payload?.choice;
        if (ARENA_POLL_CHOICES.includes(incoming)) {
          setCounts((current) => ({ ...current, [incoming]: current[incoming] + 1 }));
        }
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [match?.id]);

  const castVote = async () => {
    if (!match || !choice || voted || !connected || !channelRef.current) return;
    const result = await channelRef.current.send({ type: "broadcast", event: "vote", payload: { choice } });
    if (result !== "ok") {
      toast.error("Your vote could not be sent. Try again.");
      return;
    }
    setCounts((current) => ({ ...current, [choice]: current[choice] + 1 }));
    setVoted(true);
  };

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return <div className="space-y-3">
    <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="font-semibold">Live fan prediction</h2></div>
    {match ? <>
      <p className="text-xs text-muted-foreground">Who gets the next goal in {match.homeTeam} vs {match.awayTeam}?</p>
      <div className="grid grid-cols-3 gap-2">{ARENA_POLL_CHOICES.map((item) => <button key={item} type="button" disabled={voted} onClick={() => setChoice(item)} className={`min-w-0 rounded-xl border px-2 py-2.5 text-xs font-medium ${choice === item ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{item}</button>)}</div>
      <Button className="w-full" size="sm" disabled={!choice || voted || !connected} onClick={() => void castVote()}>{voted ? "Vote sent" : connected ? "Vote live" : "Connecting poll…"}</Button>
      <div className="space-y-2" aria-live="polite">
        {choices.map((item) => <div key={item}><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{item}</span><span className="tabular-nums">{counts[item]} · {total ? Math.round((counts[item] / total) * 100) : 0}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: total ? (counts[item] / total) * 100 + "%" : "0%" }} /></div></div>)}
      </div>
      <p className="text-[10px] text-muted-foreground">{total} live session votes · tally resets when the room closes.</p>
    </> : <p className="text-sm text-muted-foreground">Fan polls open when a verified match is live.</p>}
    <p className="text-[10px] text-muted-foreground">For fun only — no betting, stakes, wallet or payments.</p>
  </div>;
}
