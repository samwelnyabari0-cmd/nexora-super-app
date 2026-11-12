import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, SearchX } from "lucide-react";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { creators, places, catalog } from "@/features/core/data";
import { matchesPost, canDiscover } from "@/features/core/tools";
import { PostCard } from "@/components/nexora/PostCard";
import { Avatar, DemoBadge, EmptyState, PageHeader } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/explore")({
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
  const { posts } = useApp();
  const { following, toggleFollow, muted } = useWorkspace();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All");
  const [people, setPeople] = useState<
  { id: string; display_name: string | null; handle: string | null }[]
>([]);
  const query = q.trim().toLowerCase();
  const r = posts.filter((p) => canDiscover(p, muted) && matchesPost(p, q));
  const people = creators.filter(
    (c) => !muted.includes(c.id) && `${c.name} ${c.handle}`.toLowerCase().includes(query),
  );
  const locations = places.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query));
  const titles = catalog.filter((t) => `${t.title} ${t.genre}`.toLowerCase().includes(query));
  const show = (type: string) => tab === "All" || tab === type;
  const count =
    (show("Posts") ? r.length : 0) +
    (show("Creators") ? people.length : 0) +
    (show("Places") ? locations.length : 0) +
    (show("Watch") ? titles.length : 0);
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
        {["All", "Posts", "Creators", "Places", "Watch"].map((t) => (
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
        {show("Creators") && people.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Creators</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Avatar name={c.name} hue={c.hue} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{c.handle}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={following.includes(c.id) ? "outline" : "default"}
                    aria-pressed={following.includes(c.id)}
                    onClick={() => toggleFollow(c.id)}
                  >
                    {following.includes(c.id) ? "Following" : "Follow"}
                  </Button>
                </div>
              ))}
            </div>
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
        {!count && (
          <EmptyState icon={<SearchX />} title="No matches" body="Try a different keyword." />
        )}
      </div>
    </div>
  );
}
