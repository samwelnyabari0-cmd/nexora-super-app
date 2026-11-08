import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, SearchX } from "lucide-react";
import { creators, feedFilters, media } from "@/features/core/data";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { PostCard } from "@/components/nexora/PostCard";
import { Avatar, Chip, EmptyState } from "@/components/nexora/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "NEXORA — Your feed" },
      {
        name: "description",
        content: "Personalised shorts, videos and posts from creators you love, in one ecosystem.",
      },
      { property: "og:title", content: "NEXORA — Your feed" },
      {
        property: "og:description",
        content: "Shorts, stories, video and social in one premium super-app.",
      },
    ],
  }),
  component: Home,
});

const storyImgs = [media.m1, media.m2, media.m3, media.m4];

function Home() {
  const app = useApp();
  const { following, muted } = useWorkspace();
  const { passport } = app;
  const posts = useMemo(
    () => app.posts.filter((p) => !muted.includes(p.creatorId)),
    [app.posts, muted],
  );
  const [filter, setFilter] = useState<string>("For you");
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, [filter]);

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    if (f === "for you")
      return [...posts].sort(
        (a, b) =>
          Number(b.tags.some((t) => passport.interests.includes(t))) -
          Number(a.tags.some((t) => passport.interests.includes(t))),
      );
    if (f === "following")
      return posts.filter((p) => following.includes(p.creatorId) || p.creatorId === "me");
    if (f === "nearby") return posts.filter((p) => p.place);
    return posts.filter((p) => p.tags.includes(f));
  }, [posts, filter, passport.interests, following]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto min-w-0 w-full max-w-xl">
        {/* Stories */}
        <div
          className="no-scrollbar -mx-4 mb-5 flex gap-4 overflow-x-auto px-4 pb-1"
          role="list"
          aria-label="Stories"
        >
          <Link
            to="/create"
            className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs"
            role="listitem"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40">
              <Plus className="h-6 w-6" />
            </span>
            Your story
          </Link>
          {creators.map((c, i) => (
            <button
              key={c.id}
              role="listitem"
              onClick={() => {
                setStory(i);
                setSeen((s) => new Set(s).add(c.id));
              }}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs"
              aria-label={`View ${c.name}'s story`}
            >
              <span className={seen.has(c.id) ? "rounded-full border-2 border-muted p-[2px]" : ""}>
                <Avatar
                  name={c.name}
                  hue={c.hue}
                  size={seen.has(c.id) ? 60 : 60}
                  ring={!seen.has(c.id)}
                />
              </span>
              <span className="w-full truncate text-center text-muted-foreground">
                {c.handle.split(".")[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div
          className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4"
          role="toolbar"
          aria-label="Feed filters"
        >
          {feedFilters.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>

        <div className="space-y-6" aria-live="polite" aria-busy={loading}>
          {loading ? (
            [0, 1].map((i) => (
              <div key={i} className="space-y-3 rounded-3xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
              </div>
            ))
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title={`Nothing in ${filter} yet`}
              body="Try another filter or follow more creators in Explore."
              action={<Chip onClick={() => setFilter("For you")}>Back to For you</Chip>}
            />
          ) : (
            shown.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pulse Passport
          </p>
          <p className="mt-2 font-display text-lg font-semibold">Feed tuned to you</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {passport.interests.map((i) => (
              <span key={i} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                {i}
              </span>
            ))}
          </div>
          <Link to="/profile" className="mt-3 inline-block text-sm font-semibold text-accent">
            Manage what you share →
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Suggested creators
          </p>
          {creators.slice(3).map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2">
              <Avatar name={c.name} hue={c.hue} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">@{c.handle}</p>
              </div>
              <FollowButton id={c.id} />
            </div>
          ))}
        </div>
      </aside>

      <Dialog open={story !== null} onOpenChange={(v) => !v && setStory(null)}>
        <DialogContent className="max-w-sm overflow-hidden border-0 p-0">
          {story !== null && (
            <div className="relative aspect-[9/16]">
              <DialogTitle className="sr-only">{creators[story].name} story</DialogTitle>
              <img src={storyImgs[story % 4]} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-3 top-3 h-1 overflow-hidden rounded bg-foreground/30">
                <div className="h-full w-2/3 bg-foreground" />
              </div>
              <div className="absolute left-3 top-6 flex items-center gap-2 text-sm font-semibold">
                <Avatar name={creators[story].name} hue={creators[story].hue} size={30} />
                {creators[story].name}
              </div>
              <button
                className="absolute inset-y-0 right-0 w-1/2"
                aria-label="Next story"
                onClick={() => {
                  const n = (story + 1) % creators.length;
                  setStory(n);
                  setSeen((s) => new Set(s).add(creators[n].id));
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FollowButton({ id }: { id: string }) {
  const { following, toggleFollow } = useWorkspace();
  const on = following.includes(id);
  return (
    <Button
      size="sm"
      variant={on ? "outline" : "default"}
      onClick={() => toggleFollow(id)}
      aria-pressed={on}
      className="rounded-full"
    >
      {on ? "Following" : "Follow"}
    </Button>
  );
}
