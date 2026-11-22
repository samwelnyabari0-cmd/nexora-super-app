import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Video, ArrowLeft, BarChart3 } from "lucide-react";
import { useStrictMediaItems } from "@/components/nexora/StrictMediaFeed";
import { useSession } from "@/lib/session";
import { recordUserMediaPostView } from "@/lib/post-views";

export const Route = createFileRoute("/videos")({
  head: () => ({ meta: [{ title: "Videos — NEXORA" }, { name: "description", content: "Horizontal and long-form videos on NEXORA." }] }),
  component: Videos,
});

function Videos() {
  const { items, loading, error } = useStrictMediaItems("video");
  const { user } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("post");
    if (requestedId) setActiveId(requestedId);
  }, []);
  const active = items.find((item) => item.id === activeId) ?? items[0];
  useEffect(() => { if (active?.id && user?.id) void recordUserMediaPostView(active.id); }, [active?.id, user?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading Videos…</div>;
  if (error) return <div role="alert" className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!items.length) return <div className="mx-auto max-w-md py-16 text-center"><Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="font-semibold">No Videos yet</h1><p className="mt-1 text-sm text-muted-foreground">Horizontal or longer videos will appear here, separate from Reels.</p><Link to="/create" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Upload a Video</Link></div>;

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-center gap-3">
        <Link to="/explore" aria-label="Back to Explore" className="rounded-full border p-2"><ArrowLeft className="h-4 w-4" /></Link>
        <div><h1 className="text-xl font-bold">Videos</h1><p className="text-xs text-muted-foreground">Widescreen and long-form creator videos</p></div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-2xl border bg-black">
            <div className="aspect-video">
              {active?.mediaSrc && <video key={active.id} src={active.mediaSrc} poster={active.thumbnailSrc} controls playsInline className="h-full w-full object-contain" />}
            </div>
            <div className="space-y-2 p-4">
              <h2 className="font-semibold">{active?.caption || "NEXORA Video"}</h2>
              {user?.id && active?.user_id === user.id && <Link to="/dashboard" search={{ postId: active.id }} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold text-primary"><BarChart3 className="h-3.5 w-3.5" /> View insights</Link>}
              <p className="text-xs text-muted-foreground">{Number(active?.view_count ?? 0).toLocaleString()} views · {Number(active?.like_count ?? 0).toLocaleString()} likes · {Number(active?.comment_count ?? 0).toLocaleString()} comments · {Number(active?.share_count ?? 0).toLocaleString()} shares · {active?.duration_seconds ? `${Math.floor(active.duration_seconds / 60)}:${String(active.duration_seconds % 60).padStart(2, "0")}` : "Duration unavailable"}</p>
            </div>
          </div>
          <h2 className="text-sm font-semibold">Up next · {items.length}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.filter((item) => item.id !== active?.id).map((item) => (
              <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className="flex min-w-0 gap-3 rounded-xl border p-2 text-left transition hover:bg-muted/50">
                <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-black">
                  {item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" className="h-full w-full object-cover" /> : item.mediaSrc ? <video src={item.mediaSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : null}
                  <Play className="absolute bottom-2 right-2 h-4 w-4 fill-white text-white" />
                </div>
                <span className="line-clamp-3 min-w-0 text-sm font-medium">{item.caption || "NEXORA Video"}</span>
              </button>
            ))}
            {items.length === 1 && <p className="text-sm text-muted-foreground">No other Videos to play next.</p>}
          </div>
        </section>
        <aside className="space-y-3 rounded-2xl border p-3">
          <h2 className="font-semibold">Video library</h2>
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveId(item.id)} aria-pressed={active?.id === item.id} className={`flex w-full gap-3 rounded-lg p-2 text-left ${active?.id === item.id ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"}`}>
              <span className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded bg-black">{item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" className="h-full w-full object-cover" /> : <Play className="h-5 w-5 text-white" />}</span>
              <span className="line-clamp-2 text-xs font-medium">{item.caption || "Untitled Video"}</span>
            </button>
          ))}
        </aside>
      </div>
    </main>
  );
}
