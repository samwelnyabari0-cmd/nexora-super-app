import type { ReactNode } from "react";
import { Avatar } from "@/components/nexora/ui";

export type ProfileIdentity = {
  displayName: string;
  handle?: string | null;
  avatarUrl?: string | null;
};

export type ProfileIdentityCounts = {
  posts?: number;
  followers: number;
  following: number;
};

type ProfileIdentityHeaderProps = {
  profile: ProfileIdentity;
  counts: ProfileIdentityCounts;
  isOwner: boolean;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  avatarSlot?: ReactNode;
  meta?: ReactNode;
  bio?: ReactNode;
  actions?: ReactNode;
};

function Count({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const content = (
    <>
      <b className="block text-lg font-bold tabular-nums">{value.toLocaleString()}</b>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 rounded-md text-center hover:text-foreground">
      {content}
    </button>
  ) : (
    <div className="min-w-0 text-center">{content}</div>
  );
}

/** Shared responsive identity and social-count layout for owner and visitor profiles. */
export function ProfileIdentityHeader({
  profile,
  counts,
  isOwner,
  onFollowersClick,
  onFollowingClick,
  avatarSlot,
  meta,
  bio,
  actions,
}: ProfileIdentityHeaderProps) {
  const hasPosts = typeof counts.posts === "number";
  return (
    <section className="min-w-0 space-y-3" data-profile-owner={isOwner ? "true" : "false"}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0">
          {avatarSlot ?? <Avatar name={profile.displayName} src={profile.avatarUrl} size={80} ring />}
        </div>
        <div className={`grid min-w-0 flex-1 ${hasPosts ? "grid-cols-3" : "grid-cols-2"} gap-2 sm:gap-3`}>
          {hasPosts && <Count label="Posts" value={counts.posts ?? 0} />}
          <Count label="Followers" value={counts.followers} onClick={onFollowersClick} />
          <Count label="Following" value={counts.following} onClick={onFollowingClick} />
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <h2 className="truncate text-base font-bold">{profile.displayName}</h2>
        {profile.handle && <p className="truncate text-sm text-muted-foreground">@{profile.handle.replace(/^@+/, "")}</p>}
        {meta}
        {bio}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
