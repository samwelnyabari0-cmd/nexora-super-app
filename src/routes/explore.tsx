import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, SearchX } from "lucide-react";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { places, catalog } from "@/features/core/data";
import { matchesPost, canDiscover } from "@/features/core/tools";
import { PostCard } from "@/components/nexora/PostCard";
import { Avatar, DemoBadge, EmptyState, PageHeader } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { StrictMediaGrid } from "@/components/nexora/StrictMediaFeed";
export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  head: () => ({
    meta: [
      { title: "Universal search — NEXORA" },
      { name: "description", content: "Search posts, creators, places and demo watch titles." },
      { property: "og:title", content: "Universal search — NEXORA" },
      {
        property: "og:description",
        content: "Search posts, creators, places and demo watch titles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});
function Explore() {
  const { post: requestedPostId } = Route.useSearch();
  const { posts } = useApp();
  const { muted } = useWorkspace();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All");
  const [people, setPeople] = useState<{
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    account_type: string | null;
    private_profile: boolean;
  }[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const query = q.trim().toLowerCase();
  useEffect(() => {
  if (query.length < 2) {
    setPeople([]);
    return;
  }

  const timer = window.setTimeout(async () => {
    const { data, error } = await supabase.rpc("search_directory", {
      q: q.trim(),
    });

    if (error) {
      console.error("Directory search failed:", error.message);
      setPeople([]);
      return;
    }
setPeople(
  (data ?? []).filter(
    (person: { handle: string | null }) =>
      typeof person.handle === "string" && person.handle.trim().length > 0
  )
);
  }, 300);

  return () => window.clearTimeout(timer);
}, [query, q]);
  const r = posts.filter((p) => (requestedPostId ? p.id === requestedPostId : p.kind === "post") && !(p.tags ?? []).some((tag) => ["collab", "nx-type-collab"].includes(tag.toLowerCase())) && canDiscover(p, muted) && matchesPost(p, q));
  
  const locations = places.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query));
  const titles = catalog.filter((t) => `${t.title} ${t.genre}`.toLowerCase().includes(query));
  const show = (type: string) => tab === "All" || tab === type;
  const strictMediaTab = ["Reels", "Videos", "Collabs"].includes(tab);
  const count =
    (show("Posts") ? r.length : 0) +
    (show("Creators") ? people.length : 0) +
    (show("Places") ? locations.length : 0) +
    (show("Watch") ? titles.length : 0) +
    (strictMediaTab ? 1 : 0);
  return (
    <div>
      <PageHeader title="Explore" />
      <label className="mb-4 flex items-center gap-2 rounded-full border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Universal search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Posts, creators, places, watch…"
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <div className="mb-6 flex flex-wrap gap-2">
        {["All", "Posts", "Reels", "Videos", "Collabs", "Creators", "Places", "Watch"].map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="space-y-7" aria-live="polite">
        {show("Reels") && <section><h2 className="mb-3 text-lg font-semibold">Reels · vertical videos</h2><StrictMediaGrid contentType="reel" /></section>}
        {show("Videos") && <section><h2 className="mb-3 text-lg font-semibold">Videos · widescreen</h2><StrictMediaGrid contentType="video" /></section>}
        {show("Collabs") && <section><h2 className="mb-3 text-lg font-semibold">Collabs</h2><StrictMediaGrid contentType="collab" /></section>}
        {show("Creators") && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">People</h2>
            {peopleLoading ? <p className="text-sm text-muted-foreground">Finding NEXORA accounts…</p> : people.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {people.map((person) => (
                  <Link
  key={person.id}
  to="/profile"
  search={{ handle: person.handle! }}
  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
>
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.display_name ?? person.handle ?? "NEXORA User"}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar name={person.display_name ?? person.handle ?? "NEXORA User"} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{person.display_name ?? "NEXORA User"}</p>
                      <p className="truncate text-xs text-muted-foreground">@{person.handle}{person.private_profile ? " · Private" : ""}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No people found.</p>
            )}
          </section>
        )}
        {show("Places") && locations.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              Places <DemoBadge />
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {locations.map((p) => (
                <Link
                  key={p.id}
                  to="/maps"
                  search={{ q: p.name }}
                  className="rounded-lg border bg-card p-3"
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · {p.distance} (sample)
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
        {show("Watch") && titles.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              Watch <DemoBadge />
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {titles.map((t) => (
                <Link key={t.id} to="/watch" className="overflow-hidden rounded-lg border bg-card">
                  <img src={t.image} alt={t.title} className="aspect-video w-full object-cover" />
                  <div className="p-3">
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.genre} · sample catalog</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {show("Posts") && r.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Posts</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {r.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
        {!count && tab !== "All" && (
          <EmptyState icon={<SearchX />} title="No matches" body="Try another keyword or explore more accounts." />
        )}
      </div>
    </div>
  );
      }
