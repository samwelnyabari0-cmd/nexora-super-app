import { useState } from "react";
import { Clock3, FileText, Image, MapPin, Plus, Radio, Sparkles, X } from "lucide-react";

type ChatAttachmentActions = {
  gallery: () => void;
  document: () => void;
  location: () => void;
  goLive: () => void;
  ephemeral: () => void;
  aiAssist: () => void;
};

type ChatAttachmentTrayProps = {
  actions: ChatAttachmentActions;
  disabled?: boolean;
};

const ACTIONS = [
  { key: "gallery", label: "Gallery", icon: Image },
  { key: "document", label: "Document", icon: FileText },
  { key: "location", label: "Location", icon: MapPin },
  { key: "goLive", label: "Go Live", icon: Radio },
  { key: "ephemeral", label: "1h live location", icon: Clock3 },
  { key: "aiAssist", label: "AI Assist", icon: Sparkles },
] as const;

export function ChatAttachmentTray({ actions, disabled = false }: ChatAttachmentTrayProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={open ? "Close attachment options" : "Open attachment options"}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="grid h-11 w-11 place-items-center rounded-full border bg-background text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border bg-background p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Share with this conversation
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  actions[key]();
                  setOpen(false);
                }}
                className="flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
