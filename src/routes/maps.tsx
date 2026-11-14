import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Search, TriangleAlert } from "lucide-react";
import type { Place } from "@/features/core/data";
import { searchPlaces } from "@/lib/maps.functions";
import { EmptyState, PageHeader } from "@/components/nexora/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/maps")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Discover — NEXORA Maps" },
      { name: "description", content: "Discover real places with Geoapify and OpenStreetMap." },
      { property: "og:title", content: "Discover — NEXORA Maps" },
      { property: "og:description", content: "Search real places and view them on OpenStreetMap." },
    ],
  }),
  component: Maps,
});

function Maps() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const [res, setRes] = useState<Place[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const normalizedQuery = q.trim() || "Nairobi, Kenya";
  const firstPlace = res.find((place) => place.lat && place.lon);
  const mapLat = firstPlace?.lat ?? -1.286389;
  const mapLon = firstPlace?.lon ?? 36.817223;
  const mapDelta = 0.025;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLon - mapDelta}%2C${mapLat - mapDelta}%2C${mapLon + mapDelta}%2C${mapLat + mapDelta}&layer=mapnik&marker=${mapLat}%2C${mapLon}`;

  const run = (search: string) => {
    const query = search.trim() || "Nairobi, Kenya";
    setState("loading");
    setErrorMessage("");
    setSel(null);

    searchPlaces({ data: { query } })
      .then((result) => {
        if (result.error) {
          setRes([]);
          setErrorMessage(result.error);
          setState("error");
          return;
        }

        setRes(result.places);
        setState("idle");
      })
      .catch(() => {
        setRes([]);
        setErrorMessage("Geoapify search failed. Please try again.");
        setState("error");
      });
  };

  useEffect(() => {
    run(initial ?? "");
  }, [initial]);

  return (
    <div>
      <PageHeader title="Discover" subtitle="Find real places with Geoapify" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(q);
        }}
        className="mb-4 flex gap-2"
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border bg-card px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search places</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search cafes, restaurants, shops…"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={state === "loading"}
          className="bg-brand rounded-full px-5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {state === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="space-y-2">
          <div className="map-grid relative aspect-[4/3] overflow-hidden rounded-3xl border">
            <iframe
              title={`OpenStreetMap results near ${normalizedQuery}`}
              src={osmEmbedUrl}
              className="absolute inset-0 size-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href={`https://www.openstreetmap.org/?mlat=${mapLat}&mlon=${mapLon}#map=14/${mapLat}/${mapLon}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Open this area in OpenStreetMap <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="text-xs text-muted-foreground">Map data © OpenStreetMap contributors. Place search by Geoapify.</p>
        </section>

        <section aria-label="Place search results">
          {state === "loading" ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : state === "error" ? (
            <EmptyState
              icon={<TriangleAlert className="h-6 w-6" />}
              title="Place search unavailable"
              body={errorMessage}
              action={
                <button
                  type="button"
                  onClick={() => run(q)}
                  className="text-sm font-semibold text-accent"
                >
                  Try again
                </button>
              }
            />
          ) : res.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="No places found"
              body="Try another search, such as restaurants in Nairobi or cafes in Westlands."
            />
          ) : (
            <ul className="space-y-2">
              {res.map((place) => (
                <li key={place.id}>
                  <article
                    className={cn(
                      "rounded-2xl border bg-card p-3",
                      sel === place.id && "border-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSel(place.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{place.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {place.category} · {place.distance}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{place.blurb}</p>
                    </button>
                    {place.mapsUrl && (
                      <a
                        href={place.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                      >
                        Directions and details <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
