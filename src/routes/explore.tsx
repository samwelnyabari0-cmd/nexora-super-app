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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { normalizeMediaFraming } from "@/lib/media-framing";
export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  head: () => ({
    meta: [
      { title: "Universal search — NEXORA" },
      { name: "description", content: "Discover real NEXORA accounts, public posts, places and watch titles." },
      { property: "og:title", content: "Universal search — NEXORA" },
      {
        property: "og:description",
        content: "Discover real NEXORA accounts, public posts, places and watch titles.",
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
  const [selectedPost, setSelectedPost] = useState<(typeof posts)[number] | null>(null);
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
    let active = true;
    const timer = window.setTimeout(async () => {
      setPeopleLoading(true);
      const { data, error } = await (supabase as any).rpc("get_discoverable_profiles", {
        p_query: query.length >= 2 ? q.trim() : null,
        p_limit: 60,
      });
      if (!active) return;
      if (error) {
        console.error("Account discovery failed:", error.message);
        setPeople([]);
      } else {
        setPeople((data ?? []).filter((person: { handle: string | null }) => typeof person.handle === "string" && person.handle.trim().length > 0));
      }
      setPeopleLoading(false);
    }, query.length >= 2 ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
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
                    <Avatar name={person.display_name ?? person.handle ?? "NEXORA User"} src={person.avatar_url} size={44} />
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
            <div className="grid grid-cols-3 auto-rows-[112px] gap-2 sm:auto-rows-[144px]">
              {r.map((p) => {
                let preview = p.thumbnailUrl || p.image || "";
                if (preview.startsWith("[")) {
                  try {
                    const sources = JSON.parse(preview);
                    preview = Array.isArray(sources) ? String(sources[0] || "") : preview;
                  } catch { /* Keep the original source when it is not a JSON media list. */ }
                }
                const framing = normalizeMediaFraming({ focalX: p.focalX, focalY: p.focalY, zoom: p.zoom });
                return (
                  <button key={p.id} type="button" onClick={() => setSelectedPost(p)}
                    aria-label="Open post"
                    className={`relative h-full min-h-0 overflow-hidden rounded-xl border bg-muted text-left ${p.kind === "short" ? "row-span-2" : p.kind === "video" || p.mediaType?.startsWith("video/") ? "col-span-2" : ""}`}
                    style={{ backgroundColor: p.dominantColor || "#171717" }}>
                    {preview ? (
                      <img src={preview} alt={p.caption || "NEXORA post"} loading="lazy"
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: framing.focalX + "% " + framing.focalY + "%",
                          transform: "scale(" + framing.zoom + ")",
                        }} />
                    ) : (
                      <span className="line-clamp-5 flex h-full items-center justify-center p-3 text-xs text-foreground">{p.caption}</span>
                    )}
                    {p.caption && preview && (
                      <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-5 text-[10px] text-white">{p.caption}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => { if (!open) setSelectedPost(null); }}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
            <DialogTitle className="sr-only">Post details</DialogTitle>
            {selectedPost && <PostCard post={selectedPost} />}
          </DialogContent>
        </Dialog>
        {!count && tab !== "All" && (
          <EmptyState icon={<SearchX />} title="No matches" body="Try another keyword or explore more accounts." />
        )}
      </div>
    </div>
  );
      }
