import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SearchX, Users } from "lucide-react";
import { feedFilters } from "@/features/core/data";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { PostCard } from "@/components/nexora/PostCard";
import { FootballMatchPreview } from "@/components/nexora/FootballMatchPreview";
import { Avatar, Chip, EmptyState } from "@/components/nexora/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";

type DirectoryPerson = {
  id: string;
  display_name: string | null;
  handle: string;
  avatar_url: string | null;
  account_type: string | null;
  private_profile: boolean;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "NEXORA — Your feed" },
      { name: "description", content: "Discover real people, creators and posts on NEXORA." },
      { property: "og:title", content: "NEXORA — Your feed" },
      { property: "og:description", content: "Real people, stories, video and social in one super-app." },
    ],
  }),
  component: Home,
});

function Home() {
  const app = useApp();
  const { muted } = useWorkspace();
  const { user } = useSession();
  const { passport } = app;
  const posts = useMemo(() => app.posts.filter((post) => !muted.includes(post.creatorId)), [app.posts, muted]);
  const [filter, setFilter] = useState("For you");
  const [loading, setLoading] = useState(true);
  const feedLoading = loading || app.postsLoading;
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setPeopleLoading(true);
      const { data, error } = await (supabase as any).rpc("get_discoverable_profiles", {
        p_query: null,
        p_limit: 24,
      });
      if (!active) return;
      if (error) {
        console.error("Could not load account suggestions:", error.message);
        setPeople([]);
      } else {
        setPeople((data ?? []).filter((person: DirectoryPerson) => person.handle?.trim()));
      }
      setPeopleLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setFollowingIds([]);
      return;
    }
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .limit(500);
      if (!active) return;
      if (error) {
        console.error("Could not load followed accounts:", error.message);
        setFollowingIds([]);
      } else {
        setFollowingIds((data ?? []).map((row: { following_id: string }) => row.following_id));
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(timer);
  }, [filter]);

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    // The database RPC already returns a pillar-balanced, affinity-weighted order.
    // Preserve that order here; client-side sorting would undo the interleaving.
    if (f === "for you") return posts;
    if (f === "following") return posts.filter((post) =>
      followingIds.includes(post.creatorId) || post.creatorId === "me");
    if (f === "nearby") return posts.filter((post) => post.place);
    return posts.filter((post) => post.tags.includes(f));
  }, [posts, filter, followingIds]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto min-w-0 w-full max-w-xl">
        <section className="mb-5" aria-label="Discover accounts">
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
            <Link to="/explore" className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs">
              <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40">
                <Users className="h-6 w-6" />
              </span>
              Find people
            </Link>
            {people.slice(0, 12).map((person) => (
              <Link key={person.id} to="/profile/id/$userId" params={{ userId: person.id }}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs">
                <Avatar name={person.display_name ?? person.handle} src={person.avatar_url} size={60} />
                <span className="w-full truncate text-center text-muted-foreground">{person.handle}</span>
              </Link>
            ))}
            {!peopleLoading && people.length === 0 && (
              <p className="self-center text-xs text-muted-foreground">No discoverable accounts yet.</p>
            )}
          </div>
        </section>

        <FootballMatchPreview />

        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4" role="toolbar" aria-label="Feed filters">
          {feedFilters.map((item) => (
            <Chip key={item} active={filter === item} onClick={() => setFilter(item)}>{item}</Chip>
          ))}
        </div>

        <div className="space-y-6" aria-live="polite" aria-busy={feedLoading}>
          {feedLoading ? (
            [0, 1].map((index) => (
              <div key={index} className="space-y-3 rounded-3xl border bg-card p-4">
                <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-40" /></div>
                <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
              </div>
            ))
          ) : shown.length === 0 ? (
            <EmptyState icon={<SearchX className="h-6 w-6" />}
              title={filter === "Following" ? "Your Following feed is empty" : "No posts yet"}
              body={filter === "Following" ? "Follow real NEXORA accounts to see their posts here." : "When people publish public posts, they will appear here."}
              action={<Link to="/explore" className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">Explore accounts</Link>} />
          ) : shown.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pulse Passport</p>
          <p className="mt-2 font-display text-lg font-semibold">Feed tuned to you</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {passport.interests.map((interest) => (
              <span key={interest} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{interest}</span>
            ))}
          </div>
          <Link to="/profile" className="mt-3 inline-block text-sm font-semibold text-accent">Manage what you share →</Link>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4" /> Suggested accounts
          </p>
          {peopleLoading ? <p className="text-sm text-muted-foreground">Finding real accounts…</p> :
            people.slice(0, 6).map((person) => <SuggestedAccount key={person.id} person={person} />)}
          {!peopleLoading && people.length === 0 && <p className="text-sm text-muted-foreground">No accounts to suggest yet.</p>}
          <Link to="/explore" className="mt-3 inline-block text-sm font-semibold text-accent">See all accounts →</Link>
        </div>
      </aside>
    </div>
  );
}

function SuggestedAccount({ person }: { person: DirectoryPerson }) {
  const graph = useSocialGraph(person.id);
  const { user } = useSession();
  return (
    <div className="flex items-center gap-3 py-2">
      <Link to="/profile/id/$userId" params={{ userId: person.id }}>
        <Avatar name={person.display_name ?? person.handle} src={person.avatar_url} size={38} />
      </Link>
      <Link to="/profile/id/$userId" params={{ userId: person.id }} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{person.display_name ?? person.handle}</p>
        <p className="truncate text-xs text-muted-foreground">@{person.handle}{person.private_profile ? " · Private" : ""}</p>
      </Link>
      <Button size="sm" variant={graph.isFollowing ? "outline" : "default"} disabled={graph.loading || !user} onClick={() => void graph.toggleFollow()} className="rounded-full">
        {graph.isFollowing ? "Following" : graph.isPending ? "Requested" : "Follow"}
      </Button>
    </div>
  );
}

