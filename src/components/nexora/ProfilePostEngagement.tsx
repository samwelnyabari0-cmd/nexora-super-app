import { Bookmark, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";

export type ProfilePostEngagementProps = {
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onRepost: () => void;
};

function countLabel(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ProfilePostEngagement({
  liked,
  saved,
  reposted,
  likes,
  comments,
  shares,
  reposts,
  onLike,
  onComment,
  onShare,
  onSave,
  onRepost,
}: ProfilePostEngagementProps) {
  const actions = [
    {
      label: liked ? "Unlike post" : "Like post",
      Icon: Heart,
      active: liked,
      count: likes,
      onClick: onLike,
      activeClass: "text-pink-400",
      iconClass: liked ? "fill-current" : "",
    },
    {
      label: "Comment on post",
      Icon: MessageCircle,
      active: false,
      count: comments,
      onClick: onComment,
      activeClass: "text-sky-300",
      iconClass: "",
    },
    {
      label: "Share post",
      Icon: Share2,
      active: false,
      count: shares,
      onClick: onShare,
      activeClass: "text-sky-300",
      iconClass: "",
    },
    {
      label: reposted ? "Remove repost" : "Repost post",
      Icon: Repeat2,
      active: reposted,
      count: reposts,
      onClick: onRepost,
      activeClass: "text-emerald-400",
      iconClass: "",
    },
    {
      label: saved ? "Unsave post" : "Save post",
      Icon: Bookmark,
      active: saved,
      count: null,
      onClick: onSave,
      activeClass: "text-amber-300",
      iconClass: saved ? "fill-current" : "",
    },
  ];

  return (
    <div aria-label="Post engagement" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-white/15 pt-3">
      {actions.map(({ label, Icon, active, count, onClick, activeClass, iconClass }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={`inline-flex min-w-10 items-center gap-1.5 text-xs text-white/80 transition-colors hover:text-white ${active ? activeClass : ""}`}
        >
          <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
          {count !== null && <span>{countLabel(count)}</span>}
        </button>
      ))}
    </div>
  );
}
