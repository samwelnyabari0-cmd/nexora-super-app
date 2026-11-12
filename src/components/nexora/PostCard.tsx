import {
  Bookmark,
  BadgeCheck,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  Repeat2,
  Film,
  Clapperboard,
  Zap,
  MapPin,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { compact, creatorById, type Post } from "@/features/core/data";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { SceneToAction } from "./SceneToAction";

export function PostCard({ post }: { post: Post }) {
  const { liked, saved, reposted, toggleLike, toggleSave, share, repost, deletePost, addComment, passport } =
    useApp();
  const c =
    post.creatorId === "me"
      ? { name: passport.name, handle: passport.handle, hue: 295, verified: false }
      : creatorById(post.creatorId);
  const { following, toggleFollow, muted, toggleMute, report } = useWorkspace();
  const { user } = useSession();
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
  const isLiked = liked.has(post.id);
  const isSaved = saved.has(post.id);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [scene, setScene] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption);

  const header = (
    <div className="flex items-center gap-3">
      <Avatar name={c.name} hue={c.hue} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold">
          {c.name}
          {c.verified && <BadgeCheck className="h-4 w-4 text-accent" aria-label="Verified" />}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {post.kind === "short" ? (
            <Clapperboard className="h-3.5 w-3.5 text-accent" aria-label="Reel" />
          ) : post.kind === "video" || post.mediaType?.startsWith("video/") ? (
            <Film className="h-3.5 w-3.5 text-accent" aria-label="Video" />
          ) : null}
          <span>
            {post.kind === "short"
              ? "Reel"
              : post.kind === "video" || post.mediaType?.startsWith("video/")
                ? "Video"
                : "Post"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            @{c.handle} · {post.createdAt}
          </span>
        </p>
      </div>
      {post.creatorId === "me" ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Edit post">Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${post.kind === "video" ? "video" : "post"}`}
            onClick={() => {
              if (window.confirm(`Delete this ${post.kind === "video" ? "video" : "post"}? This cannot be undone.`)) void deletePost(post.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Safety and follow controls for ${c.name}`}
          onClick={() => setSafety(true)}
        >
          •••
        </Button>
      )}
      <button
        onClick={() => setScene(true)}
        className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        aria-label="Scene to action"
      >
        <Zap className="h-3.5 w-3.5" /> Act
      </button>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-1">
      <Action
        label={isLiked ? "Unlike" : "Like"}
        onClick={() => toggleLike(post.id)}
        active={isLiked}
        count={post.likes}
      >
        <Heart
          className={cn("h-5 w-5", isLiked && "animate-pop fill-destructive text-destructive")}
        />
      </Action>
      <Action
        label="Comments"
        onClick={() => setShowComments((v) => !v)}
        count={post.comments.length}
      >
        <MessageCircle className="h-5 w-5" />
      </Action>
      <Action label="Share" onClick={() => share(post.id)} count={post.shares}>
        <Share2 className="h-5 w-5" />
      </Action>
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
    <article className="overflow-hidden rounded-3xl border bg-card">
      <div className="p-4 pb-3">{header}</div>
      {mediaSource && post.mediaType?.startsWith("video/") ? (
        <video
          src={mediaSource}
          controls
          playsInline
          className={cn(
            "w-full bg-muted object-cover",
            `media-${post.filter || "original"}`,
            `format-${post.format || "landscape"}`,
          )}
        />
      ) : post.image && post.creatorId === "me" ? (
        <img
          src={mediaSource}
          alt={post.caption}
          className={cn(
  "block w-full aspect-[4/5] object-cover bg-muted",
            `media-${post.filter || "original"}`,
            `format-${post.format || "landscape"}`,
          )}
        />
      ) : post.image ? (
        <button
          onClick={() => setPlaying((p) => !p)}
          onDoubleClick={() => !isLiked && toggleLike(post.id)}
          className={cn(
            "relative block w-full overflow-hidden bg-muted",
            post.kind === "video" ? "aspect-video" : "aspect-[4/5] sm:aspect-[3/4]",
          )}
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          <img
            src={mediaSource}
            alt={post.caption}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition duration-[4000ms]",
              playing && "scale-110",
            )}
          />
          <div className="bg-scrim absolute inset-0" />
          <span className="absolute left-3 top-3 rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold uppercase backdrop-blur">
            {post.kind === "short" ? "Short" : "Video"} · {post.duration}
          </span>
          {!playing && (
            <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-background/50 backdrop-blur">
              <Play className="h-6 w-6 fill-foreground" />
            </span>
          )}
          {playing && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-muted">
              <span className="bg-brand block h-full w-1/3 animate-pulse" />
            </span>
          )}
          {post.place && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1 text-xs font-medium">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              {post.place}
            </span>
          )}
        </button>
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
              : "Published locally · not public on the internet"}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
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
              <p key={k.id} className="text-sm">
                <span className="font-semibold">@{k.author}</span> {k.text}
              </p>
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
              <label className="sr-only" htmlFor={`c-${post.id}`}>
                Add a comment
              </label>
              <input
                id={`c-${post.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-full border bg-background px-4 py-2 text-sm"
              />
              <button
                className="bg-brand grid h-9 w-9 place-items-center rounded-full text-primary-foreground"
                aria-label="Post comment"
              >
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
          <Button variant="outline" onClick={() => toggleFollow(post.creatorId)}>
            {following.includes(post.creatorId) ? "Unfollow" : "Follow"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              toggleMute(post.creatorId);
              setSafety(false);
            }}
          >
            {muted.includes(post.creatorId) ? "Unmute" : "Mute creator"}
          </Button>
          <label className="text-sm">
            Report reason
            <select
              aria-label="Report reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-lg border bg-card p-2"
            >
              {["Spam", "Harassment", "Unsafe content", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
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
                reporter_id: user.id,
                target_id: post.id,
                reason,
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
          <p className="text-xs text-muted-foreground">
            Reports are sent securely to the moderation queue.
          </p>
        </DialogContent>
      </Dialog>
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
