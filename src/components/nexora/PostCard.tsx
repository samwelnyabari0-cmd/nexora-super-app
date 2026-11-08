import {
  Bookmark,
  BadgeCheck,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  Zap,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { compact, creatorById, type Post } from "@/features/core/data";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/features/core/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { SceneToAction } from "./SceneToAction";

export function PostCard({ post }: { post: Post }) {
  const { liked, saved, toggleLike, toggleSave, share, addComment, passport } = useApp();
  const c =
    post.creatorId === "me"
      ? { name: passport.name, handle: passport.handle, hue: 295, verified: false }
      : creatorById(post.creatorId);
  const { following, toggleFollow, muted, toggleMute, report } = useWorkspace();
  const [safety, setSafety] = useState(false);
  const [reason, setReason] = useState("Spam");
  const isLiked = liked.has(post.id);
  const isSaved = saved.has(post.id);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [scene, setScene] = useState(false);
  const [playing, setPlaying] = useState(false);

  const header = (
    <div className="flex items-center gap-3">
      <Avatar name={c.name} hue={c.hue} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold">
          {c.name}
          {c.verified && <BadgeCheck className="h-4 w-4 text-accent" aria-label="Verified" />}
        </p>
        <p className="text-xs text-muted-foreground">
          @{c.handle} · {post.createdAt}
        </p>
      </div>
      {post.creatorId !== "me" && (
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
        count={post.likes + (isLiked ? 1 : 0)}
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
      {post.image && post.mediaType?.startsWith("video/") ? (
        <video
          src={post.image}
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
          src={post.image}
          alt={post.caption}
          className={cn(
            "w-full object-cover",
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
            src={post.image}
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
            onClick={() => {
              report(post.id, reason);
              setSafety(false);
            }}
          >
            Save local report
          </Button>
          <p className="text-xs text-muted-foreground">
            Reports are not submitted to moderators in this demo.
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
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
      <span className="tabular-nums">{compact(count)}</span>
    </button>
  );
}
