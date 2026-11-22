import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, Users, FileText, Heart, MessageCircle, Share2,
  Bookmark, TrendingUp, Play, Image as ImageIcon, Video, Clock3,
} from "lucide-react";
import { PageHeader } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { compact } from "@/features/core/data";
import { useSocialGraph } from "@/features/social/useSocialGraph";

type DashboardTab = "Overview" | "Engagement" | "Audience";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — NEXORA" },
      { name: "description", content: "Creator overview, engagement and audience insights." },
      { property: "og:title", content: "Creator dashboard — NEXORA" },
      { property: "og:description", content: "Your Nexora creator performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function MetricCard({ label, value, icon: Icon, note }: {
  label: string; value: string; icon: typeof Users; note?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#14141B] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-white/55">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
      {note && <p className="mt-1 text-[10px] text-white/40">{note}</p>}
    </div>
  );
}

function EmptyInsight({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-7 text-center">
      <Clock3 className="mx-auto mb-2 h-5 w-5 text-white/35" />
      <p className="text-sm text-white/60">{children}</p>
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<DashboardTab>("Overview");
  const [period, setPeriod] = useState("all");
  const { posts } = useApp();
  const { drafts } = useWorkspace();
  const { followers, following, loading: socialLoading } = useSocialGraph();

  const own = useMemo(() => posts.filter((post) => post.creatorId === "me"), [posts]);
  const metrics = useMemo(() => {
    const likes = own.reduce((sum, post) => sum + (Number(post.likes) || 0), 0);
    const comments = own.reduce((sum, post) => sum + post.comments.length, 0);
    const shares = own.reduce((sum, post) => sum + (Number(post.shares) || 0), 0);
    const interactions = likes + comments + shares;
    const formats = [
      { label: "Reels", count: own.filter((post) => post.kind === "short").length, icon: Play },
      { label: "Posts", count: own.filter((post) => post.kind === "post").length, icon: ImageIcon },
      { label: "Videos", count: own.filter((post) => post.kind === "video").length, icon: Video },
    ];
    const maxFormat = Math.max(1, ...formats.map((format) => format.count));
    return { likes, comments, shares, interactions, formats, maxFormat };
  }, [own]);

  const topContent = useMemo(
    () => [...own].sort((a, b) =>
      (b.likes + b.comments.length + b.shares) - (a.likes + a.comments.length + a.shares)
    ).slice(0, 8),
    [own],
  );

  const periodLabel = period === "all" ? "All available" : period === "30" ? "Last 30 days" : "Last 90 days";

  return (
    <main className="min-h-screen space-y-5 bg-[#0B0B0F] px-3 pb-8 pt-3 text-white sm:px-5">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white/80 hover:bg-white/10 hover:text-white">
            <Link to="/profile" aria-label="Back to profile"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">Creator dashboard</h1>
            <p className="text-[11px] text-white/45">Your professional insights</p>
          </div>
        </div>
        <label className="shrink-0">
          <span className="sr-only">Analytics date range</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="max-w-[132px] rounded-lg border border-white/10 bg-[#14141B] px-2.5 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All available</option>
            <option value="30" disabled>Last 30 days</option>
            <option value="90" disabled>Last 90 days</option>
          </select>
        </label>
      </header>

      <nav className="grid grid-cols-3 border-b border-white/10" role="tablist" aria-label="Creator analytics">
        {(["Overview", "Engagement", "Audience"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`relative min-w-0 px-1 py-3 text-center text-sm font-medium transition-colors ${tab === item ? "text-white" : "text-white/45 hover:text-white/80"}`}
          >
            {item}
            {tab === item && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-violet-500" />}
          </button>
        ))}
      </nav>

      <p className="text-[11px] text-white/40">
        {periodLabel} · Based on your published content and account records
      </p>

      {tab === "Overview" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.08] bg-[#14141B] p-4">
            <p className="text-xs font-medium text-white/55">Tracked interactions</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
              <p className="text-4xl font-bold tracking-tight tabular-nums">{compact(metrics.interactions)}</p>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/45">No trend data yet</span>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10" aria-label="Interaction composition">
              <span className="bg-violet-500" style={{ width: `${metrics.interactions ? metrics.likes / metrics.interactions * 100 : 0}%` }} />
              <span className="bg-fuchsia-400" style={{ width: `${metrics.interactions ? metrics.comments / metrics.interactions * 100 : 0}%` }} />
              <span className="bg-sky-400" style={{ width: `${metrics.interactions ? metrics.shares / metrics.interactions * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/50">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />Likes {compact(metrics.likes)}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-fuchsia-400" />Comments {compact(metrics.comments)}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />Shares {compact(metrics.shares)}</span>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5">
            <MetricCard label="Followers" value={socialLoading ? "—" : compact(followers)} icon={Users} />
            <MetricCard label="Following" value={socialLoading ? "—" : compact(following)} icon={Users} />
            <MetricCard label="Published posts" value={compact(own.length)} icon={FileText} note={`${drafts.length} saved drafts`} />
            <MetricCard label="Likes" value={compact(metrics.likes)} icon={Heart} />
            <MetricCard label="Comments" value={compact(metrics.comments)} icon={MessageCircle} />
            <MetricCard label="Shares" value={compact(metrics.shares)} icon={Share2} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Top content</h2>
              <Link to="/create" className="text-xs font-medium text-violet-300 hover:text-violet-200">Create post</Link>
            </div>
            {topContent.length ? (
              <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                {topContent.map((post) => (
                  <article key={post.id} className="w-[112px] shrink-0 snap-start">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-[#181820]">
                      {post.image ? (
                        <img src={post.thumbnailUrl || post.image} alt={post.caption || "Your published content"} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/30">{post.kind === "short" ? <Play /> : post.kind === "video" ? <Video /> : <ImageIcon />}</div>
                      )}
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-medium text-white">
                        ♥ {compact(post.likes)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] text-white/65">{post.caption || "Untitled post"}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyInsight>Your published posts will appear here when you share content.</EmptyInsight>
            )}
          </section>
        </div>
      )}

      {tab === "Engagement" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.08] bg-[#14141B] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs text-white/55">Total interactions</p><p className="mt-1 text-3xl font-bold tabular-nums">{compact(metrics.interactions)}</p></div>
              <TrendingUp className="h-5 w-5 text-violet-300" />
            </div>
            <div className="mt-4"><EmptyInsight>Daily engagement history is not available yet. This chart will appear when dated interaction analytics are connected.</EmptyInsight></div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Performance by format</h2>
            <div className="rounded-xl border border-white/[0.08] bg-[#14141B] p-4">
              {metrics.formats.map(({ label, count, icon: Icon }) => (
                <div key={label} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/75"><Icon className="h-3.5 w-3.5 text-violet-300" />{label}</span>
                    <span className="tabular-nums text-white/55">{count} posts</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${count / metrics.maxFormat * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5">
            <MetricCard label="Likes" value={compact(metrics.likes)} icon={Heart} />
            <MetricCard label="Comments" value={compact(metrics.comments)} icon={MessageCircle} />
            <MetricCard label="Shares" value={compact(metrics.shares)} icon={Share2} />
            <MetricCard label="Saves" value="—" icon={Bookmark} note="Post-save totals unavailable" />
          </section>
        </div>
      )}

      {tab === "Audience" && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5">
            <MetricCard label="Followers" value={socialLoading ? "—" : compact(followers)} icon={Users} />
            <MetricCard label="Following" value={socialLoading ? "—" : compact(following)} icon={Users} />
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#14141B] p-4">
            <h2 className="mb-2 text-sm font-semibold">Follower composition</h2>
            <EmptyInsight>Follower vs. non-follower reach requires impression-level audience analytics, which are not connected yet.</EmptyInsight>
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#14141B] p-4">
            <h2 className="mb-2 text-sm font-semibold">Top cities and countries</h2>
            <EmptyInsight>Location insights are not collected. Nexora will only show audience geography when reliable, privacy-safe analytics are available.</EmptyInsight>
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#14141B] p-4">
            <h2 className="mb-2 text-sm font-semibold">Most active times</h2>
            <EmptyInsight>Audience activity by hour is not available yet.</EmptyInsight>
          </section>
        </div>
      )}
    </main>
  );
}
