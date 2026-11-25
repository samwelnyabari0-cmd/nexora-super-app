import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Gamepad2, Search, ShieldCheck } from "lucide-react";
import {
  connectedGameCategories,
  connectedGames,
  isApprovedEmbedUrl,
  isSafeGameUrl,
  type ConnectedGame,
  type ConnectedGameCategory,
} from "./connected-games";

type ConnectedGamesProps = {
  games?: readonly ConnectedGame[];
};

const categoryLabels: Record<ConnectedGameCategory, string> = {
  football: "Football",
  racing: "Racing",
  sports: "Sports",
  arcade: "Arcade",
  puzzle: "Puzzle",
  strategy: "Strategy",
};

export function ConnectedGames({ games = connectedGames }: ConnectedGamesProps) {
  const [category, setCategory] = useState<ConnectedGameCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [activeGame, setActiveGame] = useState<ConnectedGame | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const approvedGames = useMemo(() => games.filter((game) => game.approved), [games]);
  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return approvedGames.filter((game) => {
      const matchesCategory = category === "all" || game.category === category;
      const matchesQuery = !normalizedQuery ||
        game.title.toLocaleLowerCase().includes(normalizedQuery) ||
        game.description.toLocaleLowerCase().includes(normalizedQuery) ||
        game.provider.toLocaleLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [approvedGames, category, query]);

  const openGame = (game: ConnectedGame) => {
    setLoaded(false);
    setLoadFailed(false);
    setActiveGame(game);
  };

  const backToGames = () => {
    setActiveGame(null);
    setLoaded(false);
    setLoadFailed(false);
  };

  if (activeGame) {
    const canEmbed = activeGame.mode === "embed" &&
      Boolean(activeGame.embedUrl) &&
      isApprovedEmbedUrl(activeGame, activeGame.embedUrl ?? "");

    return (
      <section className="space-y-3" aria-label="Connected game player">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={backToGames} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back to games
          </button>
          <span className="text-xs text-muted-foreground">{activeGame.provider}</span>
        </div>
        <h3 className="font-semibold">{activeGame.title}</h3>
        {canEmbed && !loadFailed ? (
          <div className="relative overflow-hidden rounded-xl border bg-black" style={{ minHeight: "min(68vh, 620px)" }}>
            {!loaded && (
              <p className="absolute inset-0 z-10 grid place-items-center bg-background text-sm text-muted-foreground">
                Loading game…
              </p>
            )}
            <iframe
              key={activeGame.id}
              src={activeGame.embedUrl}
              title={`${activeGame.title} by ${activeGame.provider}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts"
              allow=""
              {...(activeGame.allowFullscreen ? { allowFullScreen: true } : {})}
              onLoad={() => setLoaded(true)}
              onError={() => setLoadFailed(true)}
              className="relative z-0 h-[min(68vh,620px)] w-full border-0"
            />
            {isSafeGameUrl(activeGame.gameUrl) && (
              <a href={activeGame.gameUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block border-t border-white/10 px-3 py-2 text-center text-xs text-white underline">
                Game not loading? Open on website
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              {loadFailed
                ? "This game could not be loaded inside Nexora."
                : "This game is available on its provider’s website rather than inside Nexora."}
            </p>
            {isSafeGameUrl(activeGame.gameUrl) ? (
              <a
                href={activeGame.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Play on website <ExternalLink className="h-4 w-4" />
              </a>
            ) : <p className="text-xs text-destructive">The publisher link is unavailable because it did not pass Nexora’s secure URL checks.</p>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Third-party games are provided by their publishers. Nexora does not control their content or availability.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Connected Games">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Connected Games</h2>
          <p className="text-xs text-muted-foreground">Play selected games from trusted game publishers.</p>
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-xl border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search connected games</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search games or providers"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Game categories">
        <button
          type="button"
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${category === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          All
        </button>
        {connectedGameCategories.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${category === item ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {categoryLabels[item]}
          </button>
        ))}
      </div>

      {visibleGames.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleGames.map((game) => (
            <article key={game.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="grid aspect-video place-items-center overflow-hidden bg-gradient-to-br from-primary/15 via-muted to-muted">
                {game.thumbnailUrl ? (
                  <img src={game.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Gamepad2 className="h-12 w-12 text-primary/70" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{game.title}</h3>
                    <p className="text-[11px] text-muted-foreground">{categoryLabels[game.category]} · {game.provider}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Reviewed game" />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{game.description}</p>
                {game.mode === "embed" && game.embedUrl && isApprovedEmbedUrl(game, game.embedUrl) ? (
                  <button type="button" onClick={() => openGame(game)} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                    Play in Nexora
                  </button>
                ) : isSafeGameUrl(game.gameUrl) ? (
                  <a href={game.gameUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                    Play on website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-xs text-destructive">Publisher link unavailable.</p>
                )}
                {game.attribution && <p className="text-[10px] text-muted-foreground">{game.attribution}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <Gamepad2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-semibold">
            {approvedGames.length ? "No games match your search" : "More games are coming"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedGames.length
              ? "Try another title or choose a different category."
              : "We’re reviewing publishers’ permissions and mobile support before adding games. No unapproved or placeholder games are listed."}
          </p>
          {(query || category !== "all") && (
            <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="mt-3 text-xs font-semibold text-primary underline">
              Clear filters
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Third-party games follow their publishers’ terms. Some games may open on their original websites.
      </p>
    </section>
  );
}
