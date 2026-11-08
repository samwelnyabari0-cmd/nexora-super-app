import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Search, Star, TriangleAlert } from "lucide-react";
import { places, type Place } from "@/features/core/data";
import { simulatedPlaceSearch } from "@/features/core/providers";
import { DemoBadge, EmptyState, PageHeader } from "@/components/nexora/ui";
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
      { name: "description", content: "Simulated nearby discovery map." },
      { property: "og:title", content: "Discover — NEXORA Maps" },
      { property: "og:description", content: "Find places nearby (simulated)." },
    ],
  }),
  component: Maps,
});

function Maps() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const [res, setRes] = useState<Place[]>(places);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [sel, setSel] = useState<string | null>(null);
  const run = (s: string) => {
    setState("loading");
    simulatedPlaceSearch(places, s)
      .then((r) => {
        setRes(r);
        setState("idle");
      })
      .catch(() => setState("error"));
  };
  useEffect(() => {
    run(initial ?? "");
  }, [initial]);
  return (
    <div>
      <PageHeader
        title="Discover"
        subtitle="Simulated map — not live location data"
        action={<DemoBadge>Simulated</DemoBadge>}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="mb-4 flex gap-2"
      >
        <label className="flex flex-1 items-center gap-2 rounded-full border bg-card px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search places</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Food, cafe, dance… (type 'error' to test)"
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <button className="bg-brand rounded-full px-5 font-semibold text-primary-foreground">
          Search
        </button>
      </form>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div
          className="map-grid relative aspect-[4/3] overflow-hidden rounded-3xl border"
          role="img"
          aria-label="Simulated map of nearby places"
        >
          <span
            className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-glow ring-4 ring-accent/30"
            title="You (simulated)"
          />
          {res.map((p) => (
            <button
              key={p.id}
              onClick={() => setSel(p.id)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-label={p.name}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-full transition",
                sel === p.id ? "scale-125 text-accent" : "text-primary",
              )}
            >
              <MapPin className="h-8 w-8 fill-current stroke-background" />
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {state === "loading" ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : state === "error" ? (
            <EmptyState
              icon={<TriangleAlert className="h-6 w-6" />}
              title="Search failed"
              body="Simulated network error."
              action={
                <button
                  onClick={() => {
                    setQ("");
                    run("");
                  }}
                  className="text-sm font-semibold text-accent"
                >
                  Retry
                </button>
              }
            />
          ) : res.length === 0 ? (
            <EmptyState icon={<MapPin className="h-6 w-6" />} title="No places found" />
          ) : (
            res.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSel(p.id)}
                  className={cn(
                    "w-full rounded-2xl border bg-card p-3 text-left",
                    sel === p.id && "border-accent",
                  )}
                >
                  <div className="flex justify-between">
                    <p className="font-semibold">{p.name}</p>
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      {p.rating}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · {p.distance} ·{" "}
                    <span className={p.open ? "text-success" : "text-destructive"}>
                      {p.open ? "Open" : "Closed"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
