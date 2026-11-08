import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { analyticsDays, sampleAnalytics } from "@/features/core/tools";
import { compact, seedPosts } from "@/features/core/data";
export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — NEXORA" },
      { name: "description", content: "Creator overview, content, audience and sample insights." },
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
  const data = sampleAnalytics(days);
  const own = posts.filter((p) => p.creatorId === "me");
  return (
    <div className="space-y-6">
      <PageHeader title="Creator dashboard" action={<DemoBadge>Demo analytics</DemoBadge>} />
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
      <p className="text-sm text-warning">
        Sample metrics · not measured from your account · no analytics provider connected
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
              {own.length} locally published · {drafts.length} drafts
            </p>
            {own.length ? (
              own.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b py-3">
                  <p className="min-w-0 break-words">{p.caption}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.audience ?? "public"} · local
                  </span>
                </div>
              ))
            ) : (
              <p>No published content yet.</p>
            )}
            <h2 className="text-lg font-semibold">Sample top content</h2>
            {seedPosts.slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 border-b py-3">
                {p.image && (
                  <img src={p.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                )}
                <p className="min-w-0 flex-1 text-sm">{p.caption}</p>
                <span className="shrink-0 text-accent">
                  {compact(Math.round(data.views / (i + 2)))} views
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Views", value: compact(data.views), icon: Eye },
                { label: "Reach", value: compact(data.reach), icon: Users },
                { label: "Interactions", value: compact(data.interactions), icon: Heart },
                {
                  label: "Engagement rate",
                  value: `${((data.interactions / data.views) * 100).toFixed(1)}%`,
                  icon: TrendingUp,
                },
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
                aria-label={`Demo ${tab.toLowerCase()} chart for ${days} days`}
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
                <h2 className="text-lg font-semibold">Sample audience locations</h2>
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
                <h2 className="text-lg font-semibold">Sample insights</h2>
                <p className="text-sm">
                  Short videos account for 64% of sample views. Sample audience activity peaks at
                  18:00–21:00.
                </p>
                <p className="text-xs text-muted-foreground">
                  These examples are not personalized recommendations.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
