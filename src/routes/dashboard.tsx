import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, Users, FileText, Heart, MessageCircle, Share2,
  Bookmark, TrendingUp, Play, Image as ImageIcon, Video, Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { compact } from "@/features/core/data";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

type DashboardTab = "Overview" | "Engagement" | "Audience";
type DailyPoint = { date: string; count: number };
type FormatPerformance = { label: string; engagements: number; posts: number; icon: typeof Play };

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

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDay(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.01} ${points[0].y}`;

  const slopes = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    return (before + after) / 2;
  });

  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = tangents[index] / slope;
    const beta = tangents[index + 1] / slope;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[index] = scale * alpha * slope;
      tangents[index + 1] = scale * beta * slope;
    }
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const distance = (next.x - current.x) / 3;
    path += ` C ${current.x + distance} ${current.y + tangents[index] * distance}, ${next.x - distance} ${next.y - tangents[index + 1] * distance}, ${next.x} ${next.y}`;
  }
  return path;
}

function EngagementChart({ data }: { data: DailyPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 320;
  const height = 150;
  const paddingX = 10;
  const paddingY = 16;
  const maxValue = Math.max(1, ...data.map((point) => point.count));
  const chartPoints = data.map((point, index) => ({
    x: paddingX + (data.length <= 1 ? 0 : index / (data.length - 1)) * (width - paddingX * 2),
    y: height - paddingY - (point.count / maxValue) * (height - paddingY * 2),
  }));
  const linePath = buildSmoothPath(chartPoints);
  const first = chartPoints[0];
  const last = chartPoints[chartPoints.length - 1];
  const areaPath = linePath && first && last
    ? `${linePath} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`
    : "";
  const selected = activeIndex === null ? null : data[activeIndex];
  const selectedPoint = activeIndex === null ? null : chartPoints[activeIndex];
  const selectedX = selectedPoint ? (selectedPoint.x / width) * 100 : 50;

  const updateFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (data.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setActiveIndex(Math.round(ratio * (data.length - 1)));
  };

  return (
    <div className="relative pt-10">
      {selected && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#09090D] px-3 py-1.5 text-[11px] font-medium text-white shadow-xl"
          style={{ left: `${selectedX}%` }}
        >
          <span className="text-violet-300">{compact(selected.count)} engagements</span>
          <span className="mx-1.5 text-white/30">·</span>
          <span className="text-white/75">{formatDay(selected.date)}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full overflow-visible touch-pan-y"
        role="img"
        aria-label="Daily engagement history. Drag across the chart to inspect each date."
        onPointerDown={updateFromPointer}
        onPointerMove={(event) => {
          if (event.buttons > 0 || event.pointerType === "touch") updateFromPointer(event);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="nexora-engagement-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line key={fraction} x1="0" x2={width} y1={height * fraction} y2={height * fraction} stroke="white" strokeOpacity="0.07" strokeDasharray="3 5" />
        ))}
        {areaPath && <path d={areaPath} fill="url(#nexora-engagement-fill)" />}
        {linePath && <path d={linePath} fill="none" stroke="#A78BFA" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />}
        {selectedPoint && (
          <>
            <line x1={selectedPoint.x} x2={selectedPoint.x} y1="5" y2={height - paddingY} stroke="#C4B5FD" strokeOpacity="0.7" strokeDasharray="3 4" />
            <circle cx={selectedPoint.x} cy={selectedPoint.y} r="5" fill="#A78BFA" stroke="#F5F3FF" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>{data.length ? formatDay(data[0].date) : ""}</span>
        <span>{data.length > 2 ? formatDay(data[Math.floor((data.length - 1) / 2)].date) : ""}</span>
        <span>{data.length ? formatDay(data[data.length - 1].date) : ""}</span>
      </div>
      {data.length > 1 && (
        <input
          aria-label="Explore engagement by date"
          type="range"
          min={0}
          max={data.length - 1}
          value={activeIndex ?? data.length - 1}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
          className="sr-only"
        />
      )}
      <p className="mt-2 text-center text-[10px] text-white/35">Drag across the chart to explore daily engagement</p>
    </div>
  );
}

async function fetchPagedRows(table: "post_interactions" | "post_comments", postIds: string[]) {
  const rows: { post_id: string; created_at: string; kind?: string }[] = [];
  for (let start = 0; start < postIds.length; start += 150) {
    const batch = postIds.slice(start, start + 150);
    let offset = 0;
    while (true) {
      const { data, error } = await (supabase as any)
        .from(table)
        .select(table === "post_interactions" ? "post_id,created_at,kind" : "post_id,created_at")
        .in("post_id", batch)
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw error;
      const page = (data ?? []) as { post_id: string; created_at: string; kind?: string }[];
      rows.push(...page);
      if (page.length < 1000) break;
      offset += 1000;
    }
  }
  return rows;
}

function Dashboard() {
  const [tab, setTab] = useState<DashboardTab>("Overview");
  const [period, setPeriod] = useState("all");
  const [dailyEngagement, setDailyEngagement] = useState<DailyPoint[]>([]);
  const [formatPerformance, setFormatPerformance] = useState<FormatPerformance[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const { posts } = useApp();
  const { drafts } = useWorkspace();
  const { followers, following, loading: socialLoading } = useSocialGraph();
  const { user, ready: sessionReady } = useSession();

  const own = useMemo(() => posts.filter((post) => post.creatorId === "me"), [posts]);
  const metrics = useMemo(() => {
    const likes = own.reduce((sum, post) => sum + (Number(post.likes) || 0), 0);
    const comments = own.reduce((sum, post) => sum + post.comments.length, 0);
    const shares = own.reduce((sum, post) => sum + (Number(post.shares) || 0), 0);
    const interactions = likes + comments + shares;
    return { likes, comments, shares, interactions };
  }, [own]);

  const topContent = useMemo(
    () => [...own].sort((a, b) =>
      (b.likes + b.comments.length + b.shares) - (a.likes + a.comments.length + a.shares)
    ).slice(0, 8),
    [own],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadAnalytics() {
      if (!sessionReady) return;
      if (!user?.id) {
        setDailyEngagement([]);
        setFormatPerformance([]);
        setAnalyticsLoading(false);
        setAnalyticsError("Sign in to view your dated engagement analytics.");
        return;
      }
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const { data: postRows, error: postsError } = await (supabase as any)
          .from("posts")
          .select("id,created_at,media_type")
          .eq("author_id", user.id)
          .order("created_at", { ascending: true });
        if (postsError) throw postsError;
        const ownedPosts = (postRows ?? []) as { id: string; created_at: string; media_type: string | null }[];
        const ids = ownedPosts.map((post) => post.id);
        if (!ids.length) {
          if (!cancelled) {
            setDailyEngagement([]);
            setFormatPerformance([]);
            setAnalyticsLoading(false);
          }
          return;
        }

        const [interactionRows, commentRows] = await Promise.all([
          fetchPagedRows("post_interactions", ids),
          fetchPagedRows("post_comments", ids),
        ]);
        if (cancelled) return;

        const interactionByPost = new Map<string, number>();
        const dailyCounts = new Map<string, number>();
        const addEvent = (postId: string, createdAt: string) => {
          const key = dateKey(createdAt);
          dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
          interactionByPost.set(postId, (interactionByPost.get(postId) ?? 0) + 1);
        };
        interactionRows.forEach((event) => addEvent(event.post_id, event.created_at));
        commentRows.forEach((event) => addEvent(event.post_id, event.created_at));

        const formatStats = new Map<string, { engagements: number; posts: number; icon: typeof Play }>([
          ["Reels", { engagements: 0, posts: 0, icon: Play }],
          ["Posts", { engagements: 0, posts: 0, icon: ImageIcon }],
          ["Videos", { engagements: 0, posts: 0, icon: Video }],
        ]);
        ownedPosts.forEach((post) => {
          const type = (post.media_type ?? "").toLowerCase();
          const label = type.includes("reel") || type.includes("short")
            ? "Reels"
            : type.includes("video")
              ? "Videos"
              : "Posts";
          const current = formatStats.get(label)!;
          current.posts += 1;
          current.engagements += interactionByPost.get(post.id) ?? 0;
        });
        setFormatPerformance(Array.from(formatStats, ([label, value]) => ({ label, ...value })));

        const eventDates = Array.from(dailyCounts.keys()).sort();
        if (!eventDates.length) {
          setDailyEngagement([]);
        } else {
          const today = new Date();
          const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
          const start = period === "30"
            ? new Date(end.getTime() - 29 * 86_400_000)
            : period === "90"
              ? new Date(end.getTime() - 89 * 86_400_000)
              : new Date(eventDates[0] + "T00:00:00.000Z");
          const points: DailyPoint[] = [];
          for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
            const key = dateKey(cursor);
            points.push({ date: key, count: dailyCounts.get(key) ?? 0 });
          }
          setDailyEngagement(points);
        }
      } catch (error) {
        if (!cancelled) {
          setAnalyticsError(error instanceof Error ? error.message : "Could not load engagement analytics.");
          setDailyEngagement([]);
          setFormatPerformance([]);
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }
    void loadAnalytics();
    return () => { cancelled = true; };
  }, [period, sessionReady, user?.id]);

  const periodLabel = period === "all" ? "All available" : period === "30" ? "Last 30 days" : "Last 90 days";
  const formatMax = Math.max(1, ...formatPerformance.map((format) => format.engagements));
  const datedTotal = dailyEngagement.reduce((sum, point) => sum + point.count, 0);

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
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
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
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/45">Live totals from your content</span>
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
              <div>
                <p className="text-xs text-white/55">Total dated interactions</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{analyticsLoading ? "—" : compact(datedTotal)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-violet-300" />
            </div>
            {analyticsLoading ? (
              <div className="mt-4"><EmptyInsight>Loading your engagement history…</EmptyInsight></div>
            ) : analyticsError ? (
              <div className="mt-4"><EmptyInsight>{analyticsError}</EmptyInsight></div>
            ) : dailyEngagement.length ? (
              <EngagementChart data={dailyEngagement} />
            ) : (
              <div className="mt-4"><EmptyInsight>There are no dated likes or comments on your published posts in this period yet. New activity will appear here automatically.</EmptyInsight></div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Performance by format</h2>
              <p className="mt-1 text-[11px] text-white/40">Actual likes, shares and comments grouped by content type</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#14141B] p-4">
              {analyticsLoading ? (
                <p className="text-xs text-white/45">Loading format performance…</p>
              ) : analyticsError ? (
                <p className="text-xs text-white/45">Format analytics are unavailable right now.</p>
              ) : (
                formatPerformance.map(({ label, engagements, posts: postCount, icon: Icon }) => (
                  <div key={label} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 text-white/75"><Icon className="h-3.5 w-3.5 text-violet-300" />{label}</span>
                      <span className="tabular-nums text-white/55">{compact(engagements)} engagements · {postCount} posts</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${engagements / formatMax * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
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
