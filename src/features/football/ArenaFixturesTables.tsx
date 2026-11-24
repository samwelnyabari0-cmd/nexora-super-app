import { useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/nexora/ui";
import { ARENA_COMPETITIONS, selectArenaMatches, type ArenaCompetitionCode, type ArenaMatchList } from "./arena-fixtures";
import { useArenaCompetitionData, type FootballStanding } from "./useArenaCompetitionData";

type ArenaView = ArenaMatchList | "tables";

function formatNairobiDate(value: string, includeTime = true) {
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function StandingRows({ rows }: { rows: FootballStanding[] }) {
  if (!rows.length) {
    return <p className="p-5 text-center text-sm text-muted-foreground">No league table is available for this competition yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">Club</th>
            <th className="px-2 py-3 text-center font-medium">MP</th>
            <th className="px-2 py-3 text-center font-medium">W</th>
            <th className="px-2 py-3 text-center font-medium">D</th>
            <th className="px-2 py-3 text-center font-medium">L</th>
            <th className="px-2 py-3 text-center font-medium">GD</th>
            <th className="px-3 py-3 text-right font-semibold text-foreground">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.position}</td>
              <td className="max-w-[220px] truncate px-3 py-3 font-medium">{row.team_name}</td>
              <td className="px-2 py-3 text-center tabular-nums">{row.played_games}</td>
              <td className="px-2 py-3 text-center tabular-nums">{row.won}</td>
              <td className="px-2 py-3 text-center tabular-nums">{row.drawn}</td>
              <td className="px-2 py-3 text-center tabular-nums">{row.lost}</td>
              <td className="px-2 py-3 text-center tabular-nums">{row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}</td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function nairobiDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function ArenaFixturesTables() {
  const data = useArenaCompetitionData();
  const [view, setView] = useState<ArenaView>("fixtures");
  const [competition, setCompetition] = useState<ArenaCompetitionCode>("ALL");
  const [selectedDate, setSelectedDate] = useState("");

  const matchList = useMemo(
    () => view === "tables"
      ? []
      : selectArenaMatches(data.matches, view, competition).filter((match) =>
          !selectedDate || nairobiDateKey(match.kickoffAt) === selectedDate),
    [data.matches, view, competition, selectedDate],
  );
  const tableRows = useMemo(
    () => data.standings
      .filter((row) => row.standing_type === "TOTAL")
      .filter((row) => competition === "ALL" || row.competition_code === competition)
      .sort((left, right) => left.competition_code.localeCompare(right.competition_code) || left.group_name.localeCompare(right.group_name) || left.position - right.position),
    [data.standings, competition],
  );
  const competitionGroups = useMemo(() => {
    const groups = new Map<string, FootballStanding[]>();
    for (const row of tableRows) {
      const key = `${row.competition_code}:${row.group_name || "overall"}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [tableRows]);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Fixtures &amp; tables</h2>
          <p className="text-xs text-muted-foreground">Upcoming games, completed results and league positions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void data.refresh()} disabled={data.loading}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {([
          { id: "fixtures", label: "Fixtures" },
          { id: "results", label: "Results" },
          { id: "tables", label: "Tables" },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            aria-pressed={view === item.id}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${view === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setCompetition("ALL")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${competition === "ALL" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>All</button>
        {ARENA_COMPETITIONS.map((item) => (
          <button key={item.code} type="button" onClick={() => setCompetition(item.code)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${competition === item.code ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {item.label}
          </button>
        ))}
        </div>
        {view !== "tables" && (
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border bg-background px-2 py-1.5 text-xs text-foreground"
            />
            {selectedDate && <button type="button" onClick={() => setSelectedDate("")} className="underline">Clear</button>}
          </label>
        )}
      </div>

      {data.loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading fixtures and tables…</p>
      ) : view === "tables" ? (
        competitionGroups.length ? (
          <div className="space-y-4">
            {competitionGroups.map(([code, rows]) => (
              <section key={code} className="overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                  <h3 className="text-sm font-semibold">{rows[0]?.competition_name}{rows[0]?.group_name ? ` · ${rows[0].group_name}` : ""}</h3>
                  <span className="text-[10px] text-muted-foreground">{rows[0]?.current_matchday ? `Matchday ${rows[0].current_matchday}` : "Current season"}</span>
                </div>
                <StandingRows rows={rows} />
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">League tables will appear here when the football data feed is connected and synced.</p>
        )
      ) : matchList.length ? (
        <div className="divide-y">
          {matchList.map((match) => (
            <article key={match.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="mb-1 truncate text-[10px] text-muted-foreground">{match.competitionName}</p>
                <p className="truncate text-sm font-semibold">{match.homeTeam}</p>
                <p className="truncate text-sm font-semibold">{match.awayTeam}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tabular-nums">
                  {view === "results" ? `${match.homeScore ?? "–"} : ${match.awayScore ?? "–"}` : formatNairobiDate(match.kickoffAt)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">{view === "results" ? match.status : "East Africa Time"}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          {view === "fixtures" ? "No upcoming fixtures are cached for this competition yet." : "No completed results are cached for this competition yet."}
        </p>
      )}

      {data.error && <p className="mt-3 text-xs text-amber-600">{data.error}</p>}
      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground"><Table2 className="h-3 w-3" /> Data provided by football-data.org · Fixtures and scores may be delayed on the free tier.</p>
      {data.lastUpdated && <p className="mt-1 text-[10px] text-muted-foreground">Last cache update: {formatNairobiDate(data.lastUpdated)}</p>}
    </Panel>
  );
}
