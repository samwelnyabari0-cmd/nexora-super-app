import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Users, Heart, TrendingUp, Plus } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { analyticsDays } from "@/features/core/tools";
import { compact } from "@/features/core/data";
import { useSocialGraph } from "@/features/social/useSocialGraph";
export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — NEXORA" },
      {
        name: "description",
        content: "Creator overview, saved content, audience and account insights.",
      },
      { property: "og:title", content: "Creator dashboard — NEXORA" },
      {
        property: "og:description",
        content: "Creator overview, content, audience and sample insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
function Dashboard() {
  const [tab, setTab] = useState("Overview");
  const [days, setDays] = useState<number>(30);
  const { posts } = useApp();
  const { drafts } = useWorkspace();
  const { followers, following } = useSocialGraph();
  const own = posts.filter((p) => p.creatorId === "me");
  const data = useMemo(() => {
    const published = own.length;
    const likes = own.reduce((sum, post) => sum + post.likes, 0);
    const comments = own.reduce((sum, post) => sum + post.comments.length, 0);
    const shares = own.reduce((sum, post) => sum + post.shares, 0);
    const interactions = likes + comments + shares;
    const series = Array.from({ length: Math.min(days, 30) }, (_, index) => ({
      day: `Day ${index + 1}`,
      views: published,
      reach: published,
      engagement: interactions,
    }));
    return { published, likes, comments, shares, interactions, series };
  }, [days, own]);
  return (
    <div className="space-y-6">
      <PageHeader title="Creator dashboard" subtitle="Your saved account activity" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full gap-1 overflow-auto"
          role="tablist"
          aria-label="Dashboard views"
        >
          {["Overview", "Content", "Audience", "Insights"].map((t) => (
            <Button
              key={t}
              variant={tab === t ? "secondary" : "ghost"}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Analytics period">
          {analyticsDays.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d} days
            </Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Metrics are calculated from your saved posts and engagement actions.
      </p>
      <div role="tabpanel" aria-label={tab} className="space-y-6">
        {tab === "Content" ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your content</h2>
              <Button asChild>
                <Link to="/create">
                  <Plus />
                  Create
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {own.length} published · {drafts.length} drafts
            </p>
            {own.length ? (
              own.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b py-3">
                  <p className="min-w-0 break-words">{p.caption}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.audience ?? "public"}
                  </span>
                </div>
              ))
            ) : (
              <p>No published content yet.</p>
            )}
            <h2 className="text-lg font-semibold">Saved content performance</h2>
            {own.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b py-3">
                {p.image && (
                  <img src={p.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                )}
                <p className="min-w-0 flex-1 text-sm">{p.caption}</p>
                <span className="shrink-0 text-accent">
                  {p.likes} likes · {p.comments.length} comments
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Followers", value: compact(followers), icon: Users },
                { label: "Following", value: compact(following), icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg border bg-card p-4">
                  <Icon className="mb-3 h-5 w-5 text-accent" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
              {[
                { label: "Published posts", value: compact(data.published), icon: Eye },
                { label: "Likes", value: compact(data.likes), icon: Heart },
                { label: "Comments", value: compact(data.comments), icon: Users },
                { label: "Shares", value: compact(data.shares), icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg border bg-card p-4">
                  <Icon className="mb-3 h-5 w-5 text-accent" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <section>
              <h2 className="mb-4 text-lg font-semibold">
                {tab === "Audience"
                  ? "Audience reach"
                  : tab === "Insights"
                    ? "Engagement over time"
                    : "Views & reach"}
              </h2>
              <div
                className="h-72 w-full"
                role="img"
                aria-label={`Saved account activity chart for ${days} days`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" width={45} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={tab === "Insights" ? "engagement" : "reach"}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {tab === "Overview" && (
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-accent">Chart data</summary>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Views</th>
                        <th>Reach</th>
                        <th>Interactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.series.map((d) => (
                        <tr key={d.day}>
                          <td>{d.day}</td>
                          <td>{d.views}</td>
                          <td>{d.reach}</td>
                          <td>{d.engagement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            {tab === "Audience" && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Audience locations</h2>
                {[
                  ["Nairobi", 62],
                  ["Mombasa", 23],
                  ["Other", 15],
                ].map(([city, n]) => (
                  <div key={city} className="flex items-center gap-3">
                    <span className="w-24 text-sm">{city}</span>
                    <progress max="100" value={n} className="h-2 flex-1 accent-accent" />
                    <span className="text-sm">{n}%</span>
                  </div>
                ))}
              </section>
            )}
            {tab === "Insights" && (
              <section className="space-y-2 border-t pt-5">
                <h2 className="text-lg font-semibold">Account insights</h2>
                <p className="text-sm">
                  Your saved engagement actions appear here as posts receive likes, comments, and
                  shares.
                </p>
                <p className="text-xs text-muted-foreground">
                  Connect a social analytics provider later for reach and impression-level
                  reporting.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
