import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Share2, Film } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { useStrictMediaItems } from "@/components/nexora/StrictMediaFeed";

export const Route = createFileRoute("/reels")({
  head: () => ({ meta: [{ title: "Reels — NEXORA" }, { name: "description", content: "Vertical short-form videos on NEXORA." }] }),
  component: Reels,
});

function Reels() {
  const { user } = useSession();
  const { items, loading, error } = useStrictMediaItems("reel");
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) { setLiked([]); return; }
    void supabase.rpc("get_my_liked_user_media_posts").then(({ data, error: rpcError }) => {
      if (active && !rpcError) setLiked((data ?? []) as string[]);
    });
    return () => { active = false; };
  }, [user?.id]);

  async function toggleLike(postId: string) {
    if (!user) return toast.error("Sign in to like Reels.");
    const wasLiked = liked.includes(postId);
    const { data, error: rpcError } = await (supabase as any).rpc(
      wasLiked ? "unlike_user_media_post" : "like_user_media_post",
      { target_post_id: postId },
    );
    if (rpcError) return toast.error("Could not update your like.");
    setLiked((current) => wasLiked ? current.filter((id) => id !== postId) : [...current, postId]);
    // The database RPC remains the source of truth for the like counter.
    void data;
  }

  async function shareReel(postId: string, caption: string | null) {
    const url = `${window.location.origin}/reels?post=${postId}`;
    try {
      if (navigator.share) await navigator.share({ title: "NEXORA Reel", text: caption || "Watch this Reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Reel link copied."); }
      if (user) {
        const { error: shareError } = await (supabase as any).rpc("increment_user_media_post_shares", { target_post_id: postId });
        if (shareError) toast.error("Link shared, but the share count could not be updated.");
      }
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") toast.error("Could not share this Reel.");
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading Reels…</div>;
  if (error) return <div role="alert" className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!items.length) return <div className="mx-auto max-w-md py-16 text-center"><Film className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="font-semibold">No Reels yet</h1><p className="mt-1 text-sm text-muted-foreground">Vertical videos up to 90 seconds will appear here.</p><Link to="/create" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create a Reel</Link></div>;

  const requestedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("post") : null;
  const ordered = requestedId ? [...items].sort((a, b) => Number(b.id === requestedId) - Number(a.id === requestedId)) : items;

  return (
    <main className="fixed inset-0 z-[60] h-[100svh] bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <Link to="/explore" aria-label="Back to Explore" className="rounded-full bg-black/50 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold">NEXORA REELS</span>
        <Link to="/create" className="rounded-full bg-black/50 px-3 py-2 text-xs font-semibold">＋ Create</Link>
      </div>
      <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {ordered.map((item) => (
          <article key={item.id} className="relative flex h-[100svh] min-h-[100svh] snap-start snap-always items-center justify-center bg-black">
            {item.mediaSrc ? <video src={item.mediaSrc} poster={item.thumbnailSrc} controls playsInline loop preload="metadata" className="h-full w-full object-contain" /> : <p className="p-8 text-center">{item.caption}</p>}
            <div className="absolute bottom-8 left-4 right-20 z-20 space-y-2 bg-gradient-to-t from-black/70 to-transparent pb-3 pt-10">
              <p className="text-xs font-semibold">NEXORA Creator</p>
              <p className="whitespace-pre-wrap text-sm">{item.caption}</p>
              <p className="text-[11px] text-white/70">{item.duration_seconds ?? "—"} sec · {Number(item.view_count ?? 0).toLocaleString()} views</p>
            </div>
            <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5">
              <button type="button" onClick={() => void toggleLike(item.id)} aria-label={liked.includes(item.id) ? "Unlike Reel" : "Like Reel"} className="flex flex-col items-center gap-1"><Heart className={`h-7 w-7 ${liked.includes(item.id) ? "fill-pink-500 text-pink-500" : "text-white"}`} /><span className="text-[11px]">{Number(item.like_count ?? 0)}</span></button>
              <div className="flex flex-col items-center gap-1" aria-label="Comments"><MessageCircle className="h-7 w-7" /><span className="text-[11px]">{Number(item.comment_count ?? 0)}</span></div>
              <button type="button" onClick={() => void shareReel(item.id, item.caption)} aria-label="Share Reel" className="flex flex-col items-center gap-1"><Share2 className="h-7 w-7" /><span className="text-[11px]">{Number(item.share_count ?? 0)}</span></button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
