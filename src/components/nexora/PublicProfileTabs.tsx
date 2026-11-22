import { Grid3X3, PlaySquare, ShoppingBag, Users } from "lucide-react";

export type PublicProfileTab = "grid" | "reels" | "store" | "communities";
type PublicProfileTabChange = React.Dispatch<React.SetStateAction<PublicProfileTab>>;

const TABS = [
  { id: "grid", label: "Grid", Icon: Grid3X3 },
  { id: "reels", label: "Reels", Icon: PlaySquare },
  { id: "store", label: "Store", Icon: ShoppingBag },
  { id: "communities", label: "Communities", Icon: Users },
] as const;

export function PublicProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: PublicProfileTab;
  onChange: PublicProfileTabChange;
}) {
  return (
    <nav
      aria-label="Profile content"
      role="tablist"
      className="sticky top-12 z-20 grid h-11 grid-cols-4 border-y border-slate-800 bg-slate-950/95 backdrop-blur"
    >
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onChange(id)}
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 text-[11px] font-semibold transition-colors sm:text-xs ${
            activeTab === id
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}
