import type { ReactNode } from "react";
import { ChevronDown, LockKeyhole } from "lucide-react";
import { ChatLockPanel } from "@/components/nexora/ChatLockPanel";
import { DisappearingSettingsControl } from "@/components/nexora/DisappearingSettingsControl";
import type { ChatLockState } from "@/hooks/useChatLock";

type ConversationDetailsSheetProps = {
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  initials: string;
  chatKind: "direct" | "group";
  chatId: string;
  lock: ChatLockState;
  profileHref?: string;
  trailing?: ReactNode;
};

export function ConversationDetailsSheet({
  title,
  subtitle,
  avatarUrl,
  initials,
  chatKind,
  chatId,
  lock,
  profileHref,
  trailing,
}: ConversationDetailsSheetProps) {
  return (
    <details className="group relative min-w-0 flex-1">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 font-semibold">{initials}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-left text-sm font-semibold">{title}</span>
          <span className="block truncate text-left text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(70dvh,34rem)] min-w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border bg-background p-3 shadow-xl sm:right-auto sm:w-80">
        <div className="mb-3 flex items-center gap-2 border-b pb-3">
          <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Conversation details</p>
        </div>
        <div className="space-y-3">
          {profileHref && <a href={profileHref} className="block text-sm font-medium text-primary hover:underline">View profile</a>}
          {trailing}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Privacy lock</h2>
            <ChatLockPanel lock={lock} />
          </section>
          <section className="space-y-2 border-t pt-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message expiry</h2>
            <DisappearingSettingsControl chatKind={chatKind} chatId={chatId} />
          </section>
        </div>
      </div>
    </details>
  );
}
