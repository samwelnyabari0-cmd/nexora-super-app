import type { ReactNode } from "react";

export function ProfileIdentityHeader({
  avatar,
  identity,
  counts,
  className = "",
}: {
  avatar: ReactNode;
  identity: ReactNode;
  counts: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1 space-y-2">
          {identity}
          {counts}
        </div>
      </div>
    </div>
  );
}
