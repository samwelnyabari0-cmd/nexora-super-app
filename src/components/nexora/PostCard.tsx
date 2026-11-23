import {
  Bookmark,
  BadgeCheck,
  Heart,
  MessageCircle,
  Send,
  Share2,
  Repeat2,
  Zap,
  Trash2,
  Flag,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Maximize2,
  BarChart3,
  Eye,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { compact, creatorById, type Post } from "@/features/core/data";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { useApp } from "@/features/core/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { SceneToAction } from "./SceneToAction";
import { ShareSheet } from "./ShareSheet";
import { sharePost } from "@/lib/social-activity";
import { typeFromTags, visibleTags } from "@/lib/post-types";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";
import { getFrameAspectRatio, getMediaAspectRatioValue, normalizeMediaFraming } from "@/lib/media-framing";
import { recordUserMediaPostView } from "@/lib/post-views";
import { formatRelativeTime, formatExactDateTime } from "@/lib/format-relative-time";

export function PostCard({ post }: { post: Post }) {
  const { liked, saved, reposted, toggleLike, toggleSave, repost, deletePost, addComment, passport } =
    useApp();
  const fallbackCreator = creatorById(post.creatorId);
  const c = {
    name: post.creatorId === "me" ? passport.name : post.creatorName ?? fallbackCreator.name,
    handle: post.creatorId === "me" ? passport.handle : post.creatorHandle ?? fallbackCreator.handle,
    avatarUrl: post.creatorAvatarUrl ?? (post.creatorId === "me" ? passport.avatarUrl ?? null : null),
    hue: fallbackCreator.hue,
    verified: post.creatorId === "me" ? false : fallbackCreator.verified,
  };
  const { muted, toggleMute, report } = useWorkspace();
  const { user } = useSession();
  const socialGraph = useSocialGraph(post.creatorId === "me" ? "" : post.creatorId);
  const [safety, setSafety] = useState(false);
  const [reason, setReason] = useState("Spam");
  const mediaSources = (() => {
    if (!post.image) return [];
    try {
      const parsed = JSON.parse(post.image);
      return Array.isArray(parsed) ? parsed : [post.image];
    } catch {
      return [post.image];
    }
  })();
  const mediaSource = mediaSources[0];
  const [refreshedMediaUrl, setRefreshedMediaUrl] = useState<string | undefined>();
  const attemptedRefresh = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const isDbPost = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.id);
  const [videoMuted, setVideoMuted] = useState(true);
  const displayedMediaSource = refreshedMediaUrl ?? mediaSource;
  const mediaFrameRatio = post.frameRatio && post.frameRatio !== "original"
    ? getFrameAspectRatio(post.frameRatio as any, getMediaAspectRatioValue(post.aspectRatio))
    : getMediaAspectRatioValue(post.aspectRatio);
  const mediaFrameWidth = mediaFrameRatio
    ? `min(100%, calc(78svh * ${mediaFrameRatio}))`
    : "100%";
  const refreshMediaUrl = async (failedUrl: string) => {
    if (post.mediaStorageProvider !== "r2" || !post.mediaPostId || !failedUrl) return;
    if (attemptedRefresh.current.has(failedUrl)) return;
    attemptedRefresh.current.add(failedUrl);
    const freshUrl = await getFreshR2MediaPlaybackUrl(post.mediaPostId, "media");
    if (freshUrl && freshUrl !== failedUrl) setRefreshedMediaUrl(freshUrl);
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        video.muted = true;
        setVideoMuted(true);
        void video.play().catch(() => undefined);
      } else video.pause();
    }, { threshold: [0, 0.55, 1] });
    observer.observe(video);
    return () => { observer.disconnect(); video.pause(); };
  }, [displayedMediaSource]);


  useEffect(() => {
    const card = cardRef.current;
    // PostCard can be backed by the canonical user_media_posts row even when
    // its presentation-level post id differs from the media row id.
    const trackedPostId = post.mediaPostId || post.id;
    const isTrackableId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackedPostId);
    if (!card || !user?.id || !isTrackableId || post.mediaType?.startsWith("video/") || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let recorded = false;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && !recorded && !timer) {
        timer = setTimeout(() => {
          recorded = true;
          timer = undefined;
          void recordUserMediaPostView(trackedPostId);
        }, 1200);
      } else if ((!entry.isIntersecting || entry.intersectionRatio < 0.55) && timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: [0, 0.55, 1] });
    observer.observe(card);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [post.id, post.mediaPostId, post.mediaType, user?.id]);

  const isLiked = liked.has(post.id);
  const isSaved = saved.has(post.id);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [scene, setScene] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBump, setShareBump] = useState(0);
  const contentType = typeFromTags(post.tags ?? []);
  const typeLabel =
    contentType === "ad"
      ? "Sponsored"
      : contentType === "story"
        ? "Story"
        : contentType === "carousel"
          ? "Carousel"
          : post.kind === "short"
            ? "Reel"
            : post.kind === "video" || post.mediaType?.startsWith("video/")
              ? "Video"
              : "Post";

  // Count a share only once per person per post, so tapping Share again does not inflate it.
  const countShare = async () => {
    if (!user || !isDbPost) return;
    const key = `nx.shared.${user.id}`;
    let done: string[] = [];
    try {
      done = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      done = [];
    }
    if (done.includes(post.id)) return;
    try {
      localStorage.setItem(key, JSON.stringify([...done, post.id].slice(-500)));
    } catch {
      /* storage unavailable: still count this one */
    }
    try {
      await sharePost(post.id);
      setShareBump(1);
    } catch {
      toast.error("The share count could not be updated.");
    }
  };

  const header = (
    <div className="flex min-w-0 items-center gap-3">
      <Link to="/profile/$handle" params={{ handle: c.handle }} className="shrink-0" aria-label="Open creator profile">
        <Avatar name={c.name} hue={c.hue} src={c.avatarUrl} size={38} />
      </Link>
      <Link to="/profile/$handle" params={{ handle: c.handle }} className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold"
          aria-label={typeLabel + " by " + c.name + " at " + post.createdAt}>
          <span className="truncate">{c.name}</span>
          {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label="Verified" />}
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{c.handle}</span>
        </p>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Post actions"><MoreHorizontal className="h-5 w-5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {post.creatorId === "me" ? <>
            <DropdownMenuItem onSelect={() => { window.location.href = `/dashboard?postId=${encodeURIComponent(post.id)}`; }}><BarChart3 className="mr-2 h-4 w-4" />View insights</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing(true)}>Edit post</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
              if (window.confirm("Delete this post? This cannot be undone.")) void deletePost(post.id);
            }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </> : <DropdownMenuItem onSelect={() => setSafety(true)}>Follow, mute or report</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setScene(true)}><Zap className="mr-2 h-4 w-4" />Act on this post</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-1">
      <Action label={isLiked ? "Unlike" : "Like"} onClick={() => toggleLike(post.id)} active={isLiked} count={post.likes}>
        <Heart className={cn("h-5 w-5", isLiked && "animate-pop fill-destructive text-destructive")} />
      </Action>
      <Action label="Comments" onClick={() => setShowComments((v) => !v)} count={post.comments.length}>
        <MessageCircle className="h-5 w-5" />
      </Action>
      <Action label="Share" onClick={() => setShareOpen(true)} count={post.shares + shareBump}>
        <Share2 className="h-5 w-5" />
      </Action>
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground" aria-label={`${compact(post.views ?? 0)} views`}><Eye className="h-5 w-5" /><span className="tabular-nums">{compact(post.views ?? 0)}</span></span>
      <Action label={reposted.has(post.id) ? "Already reposted" : "Repost"} onClick={() => repost(post.id)} count={post.reposts ?? 0} active={reposted.has(post.id)} disabled={reposted.has(post.id)}>
        <Repeat2 className="h-5 w-5" />
      </Action>
      <button
        onClick={() => toggleSave(post.id)}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Unsave" : "Save"}
        className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
      >
        <Bookmark className={cn("h-5 w-5", isSaved && "fill-accent text-accent")} />
      </button>
    </div>
  );

  return (
    <article ref={cardRef} className="overflow-hidden rounded-3xl border bg-card">
      <div className="p-4 pb-3">{header}</div>
      {mediaSource && post.mediaType?.startsWith("video/") ? (
        <div className="relative w-full overflow-hidden bg-muted" style={{
          backgroundColor: post.dominantColor || "#171717",
          aspectRatio: mediaFrameRatio ?? undefined,
          width: mediaFrameWidth,
          marginInline: "auto",
          maxHeight: "78svh",
        }}>
          <video ref={videoRef} src={displayedMediaSource} poster={post.thumbnailUrl} onPlay={() => { if (user?.id) void recordUserMediaPostView(post.mediaPostId || post.id); }}
            onError={(event) => void refreshMediaUrl(event.currentTarget.currentSrc)}
            playsInline loop muted={videoMuted} preload="metadata"
            onClick={(event) => {
              const video = event.currentTarget;
              if (video.paused) void video.play().catch(() => undefined);
              else video.pause();
            }}
            className={cn("block w-full", post.frameRatio && post.frameRatio !== "original" ? "h-full" : "h-auto max-h-[78svh]")}
            style={{
              objectFit: post.frameRatio && post.frameRatio !== "original" ? "cover" : "contain",
              objectPosition: (normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).focalX + "% ") + normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).focalY + "%",
              transform: "scale(" + normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).zoom + ")",
            }} />
          <button type="button" onClick={() => setVideoMuted((muted) => !muted)}
            aria-label={videoMuted ? "Unmute video" : "Mute video"}
            className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/65 text-white backdrop-blur">
            {videoMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {post.kind === "short" && (
            <button type="button" onClick={() => { window.location.href = "/reels?post=" + encodeURIComponent(post.id); }}
              aria-label="Open Reel full screen"
              className="absolute bottom-3 right-16 grid h-10 w-10 place-items-center rounded-full bg-black/65 text-white backdrop-blur">
              <Maximize2 className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : post.image ? (
        <div className="w-full overflow-hidden bg-muted" style={{
          backgroundColor: post.dominantColor || "#171717",
          aspectRatio: mediaFrameRatio ?? undefined,
          width: mediaFrameWidth,
          marginInline: "auto",
          maxHeight: "78svh",
        }}>
          <img src={displayedMediaSource} onError={(event) => void refreshMediaUrl(event.currentTarget.currentSrc)}
            alt={post.caption} loading="lazy"
            className={cn("block w-full", post.frameRatio && post.frameRatio !== "original" ? "h-full" : "h-auto max-h-[78svh]")}
            style={{
              objectFit: post.frameRatio && post.frameRatio !== "original" ? "cover" : "contain",
              objectPosition: (normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).focalX + "% ") + normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).focalY + "%",
              transform: "scale(" + normalizeMediaFraming({ focalX: post.focalX, focalY: post.focalY, zoom: post.zoom }).zoom + ")",
            }} />
        </div>
      ) : null}
      <div className="space-y-2 p-4 pt-3">
        {actions}
        <p className={cn("leading-relaxed", !post.image && "text-lg font-medium")}>
          {post.caption}
        </p>
        {post.creatorId === "me" && (
          <p className="text-xs text-warning">
            {post.audience === "private"
              ? "Only me · excluded from discovery"
              : "Public · visible on NEXORA"}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {visibleTags(post.tags ?? []).map((t) => (
            <span key={t} className="text-xs text-accent">
              #{t}
            </span>
          ))}
        </div>
        {showComments && (
          <div className="space-y-2 border-t pt-3">
            {post.comments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No comments yet — start the conversation.
              </p>
            )}
            {post.comments.map((k) => (
              <div key={k.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-semibold">@{k.author}</span> {k.text}
                  </p>
                  {k.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(k.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {user && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k.id) && (
                  <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Report comment" title="Report comment"
                    onClick={async () => {
                      const { error } = await (supabase as any).from("reports").insert({
                        reporter_id: user.id, target_id: k.id, target_type: "comment",
                        reason: "Other", details: "Comment reported from the Nexora feed."
                      });
                      if (error) toast.error("Comment report could not be submitted.");
                      else toast.success("Comment reported to moderators.");
                    }}>
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) {
                  addComment(post.id, draft.trim());
                  setDraft("");
                }
              }}
              className="flex gap-2"
            >
              <label className="sr-only" htmlFor={`c-${post.id}`}>Add a comment</label>
              <input
                id={`c-${post.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-full border bg-background px-4 py-2 text-sm"
              />
              <button className="bg-brand grid h-9 w-9 place-items-center rounded-full text-primary-foreground" aria-label="Post comment">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogTitle>Edit {post.kind === "short" ? "reel" : post.kind}</DialogTitle>
          <textarea className="min-h-28 w-full rounded-xl border bg-background p-3" value={editedCaption} onChange={(event) => setEditedCaption(event.target.value)} aria-label="Edit caption" />
          <Button onClick={async () => { if (!user || !editedCaption.trim()) return; const { error } = await (supabase as any).from("user_media_posts")
            .update({ caption: editedCaption.trim() })
            .eq("id", post.id)
            .eq("user_id", user.id); if (error) toast.error("Could not save changes"); else { toast.success("Post updated"); setEditing(false); window.location.reload(); } }}>Save changes</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={safety} onOpenChange={setSafety}>
        <DialogContent>
          <DialogTitle>{c.name}</DialogTitle>
          <Button variant="outline" disabled={!user || socialGraph.loading} onClick={() => { void socialGraph.toggleFollow(); setSafety(false); }}>
            {!user ? "Sign in to follow" : socialGraph.isFollowing ? "Unfollow" : socialGraph.isPending ? "Requested · Cancel request" : "Follow"}
          </Button>
          <Button variant="outline" onClick={() => { toggleMute(post.creatorId); setSafety(false); }}>
            {muted.includes(post.creatorId) ? "Unmute" : "Mute creator"}
          </Button>
          <label className="text-sm">
            Report reason
            <select aria-label="Report reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-lg border bg-card p-2">
              {["Spam", "Harassment", "Unsafe content", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!user) {
                setSafety(false);
                toast.error("Sign in to submit a report to moderators.");
                return;
              }
              const { error } = await (supabase as any).from("reports").insert({
                reporter_id: user.id, target_id: post.id, target_type: "post", reason,
              });
              if (error) {
                toast.error("Report could not be submitted.");
                return;
              }
              report(post.id, reason);
              setSafety(false);
              toast.success("Report submitted to moderators.");
            }}
          >
            Submit report
          </Button>
          <p className="text-xs text-muted-foreground">Reports are sent securely to the moderation queue.</p>
        </DialogContent>
      </Dialog>
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        postId={post.id}
        caption={post.caption}
        mediaUrl={displayedMediaSource && /^https?:/i.test(displayedMediaSource) ? displayedMediaSource : undefined}
        onShared={() => void countShare()}
      />
      <SceneToAction post={post} open={scene} onOpenChange={setScene} />
    </article>
  );
}

function Action({
  children,
  label,
  onClick,
  count,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  count: number;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
      <span className="tabular-nums">{compact(count)}</span>
    </button>
  );
}
