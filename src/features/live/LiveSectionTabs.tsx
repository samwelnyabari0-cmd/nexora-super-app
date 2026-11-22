import { Radio, Tv, MapPin } from "lucide-react";

export type LiveSection = "watch" | "studio" | "map";

const sections: Array<{ id: LiveSection; label: string; icon: typeof Radio }> = [
  { id: "watch", label: "Watch", icon: Tv },
  { id: "studio", label: "Go Live & Studio", icon: Radio },
  { id: "map", label: "Map & Co-watch", icon: MapPin },
];

export function LiveSectionTabs({
  active,
  onChange,
}: {
  active: LiveSection;
  onChange: (section: LiveSection) => void;
}) {
  return (
    <div role="tablist" aria-label="LIVE sections" className="grid grid-cols-3 gap-1 rounded-2xl border bg-muted/60 p-1">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${active === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}
