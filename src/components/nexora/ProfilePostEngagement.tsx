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

export function ProfilePostEngagement(_props: ProfilePostEngagementProps) {
  return null;
}
