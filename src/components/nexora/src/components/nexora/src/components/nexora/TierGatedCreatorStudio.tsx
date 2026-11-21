import { useState } from "react";
import { AudioLines, Clapperboard, Lock, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  userPlan: "free" | "pro" | "studio";
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  filterIntensity: number;
  onFilterIntensityChange: (value: number) => void;
  onNavigateToSubscriptions: () => void;
};

type DockTab = "filters" | "audio" | "studio";
type UpgradeTier = "pro" | "studio";

export default function TierGatedCreatorStudio({
  userPlan,
  selectedFilter,
  onFilterChange,
  filterIntensity,
  onFilterIntensityChange,
  onNavigateToSubscriptions,
}: Props) {
  const [tab, setTab] = useState<DockTab>("filters");
  const [upgrade, setUpgrade] = useState<UpgradeTier | null>(null);
  const isPro = userPlan === "pro" || userPlan === "studio";
  const isStudio = userPlan === "studio";

  const openUpgrade = (tier: UpgradeTier) => setUpgrade(tier);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="grid shrink-0 grid-cols-3 border-b bg-background" aria-label="Studio tools">
        <button type="button" onClick={() => setTab("filters")} aria-pressed={tab === "filters"} className={\`flex flex-col items-center gap-1 border-b-2 px-2 py-3 text-xs font-medium \${tab === "filters" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}\`}>
          <SlidersHorizontal className="h-5 w-5" /> Filters
        </button>
        <button type="button" onClick={() => setTab("audio")} aria-pressed={tab === "audio"} className={\`flex flex-col items-center gap-1 border-b-2 px-2 py-3 text-xs font-medium \${tab === "audio" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}\`}>
          <AudioLines className="h-5 w-5" /> Audio
        </button>
        <button type="button" onClick={() => setTab("studio")} aria-pressed={tab === "studio"} className={\`flex flex-col items-center gap-1 border-b-2 px-2 py-3 text-xs font-medium \${tab === "studio" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}\`}>
          <Clapperboard className="h-5 w-5" /> Studio
        </button>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {tab === "filters" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {["original", "vivid", "mono", "cinema", "soft"].map((filter) => (
                <Button key={filter} type="button" size="sm" variant={selectedFilter === filter ? "default" : "outline"} className="capitalize" onClick={() => onFilterChange(filter)}>
                  {filter}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Filter intensity</p>
                <p className="text-xs text-muted-foreground">{isPro ? "Fine-tune the selected look" : "Unlock precision controls with Pro"}</p>
              </div>
              {!isPro && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">PRO</span>}
            </div>
            {isPro ? (
              <input aria-label="Filter intensity" type="range" min="0" max="100" value={filterIntensity} onChange={(event) => onFilterIntensityChange(Number(event.target.value))} className="w-full accent-primary" />
            ) : (
              <Button type="button" variant="outline" className="w-full justify-between" onClick={() => openUpgrade("pro")}>
                <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Unlock filter intensity</span>
                <span className="text-xs text-muted-foreground">PRO</span>
              </Button>
            )}
          </div>
        )}

        {tab === "audio" && (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><AudioLines className="h-4 w-4" /> Audio workspace</div>
              <p className="text-xs leading-relaxed text-muted-foreground">Add a soundtrack, balance original audio and record a voiceover in the Studio editor.</p>
            </div>
            <Button type="button" variant="outline" className="w-full justify-between" onClick={() => isStudio ? setTab("studio") : openUpgrade("studio")}>
              <span className="flex items-center gap-2"><AudioLines className="h-4 w-4" /> Voiceover & audio mix</span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">STUDIO</span>
            </Button>
          </div>
        )}

        {tab === "studio" && (
          <div className="space-y-3">
            {isStudio ? (
              <div className="rounded-xl border bg-card p-3">
                <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" /> Studio unlocked</p>
                <p className="mt-1 text-xs text-muted-foreground">Timeline editing, voiceover and audio mixing are available in the advanced editor.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-card p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold"><WandSparkles className="h-4 w-4" /> Studio editing suite</p>
                  <p className="mt-1 text-xs text-muted-foreground">Unlock timeline editing, audio mixing and voiceover recording.</p>
                </div>
                <Button type="button" className="w-full justify-between" onClick={() => openUpgrade("studio")}>
                  <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Unlock Studio tools</span>
                  <span className="rounded-full bg-primary-foreground/15 px-2 py-1 text-[10px] font-bold">STUDIO</span>
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {upgrade && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/60" role="presentation" onClick={() => setUpgrade(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-upgrade-title"
            className="w-full animate-in slide-in-from-bottom rounded-t-3xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{upgrade === "pro" ? "PRO ACCESS" : "STUDIO ACCESS"}</p>
                <h2 id="creator-upgrade-title" className="mt-1 text-xl font-bold">Unlock {upgrade === "pro" ? "Pro filter controls" : "Creator Studio"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{upgrade === "pro" ? "Dial in every look with advanced filter intensity." : "Edit timelines, mix audio and record voiceovers."}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close upgrade sheet" onClick={() => setUpgrade(null)}>×</Button>
            </div>
            <div className="mb-4 rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{upgrade === "pro" ? "Nexora Pro" : "Nexora Studio"}</span>
                <span className="text-xl font-bold tabular-nums">{upgrade === "pro" ? "$9.99" : "$24.99"}<span className="text-xs font-normal text-muted-foreground"> / month</span></span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{upgrade === "pro" ? "Advanced creative controls for your content." : "The full creator editing workspace for serious production."}</p>
            </div>
            <Button type="button" className="w-full" onClick={onNavigateToSubscriptions}>Continue to plans</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => setUpgrade(null)}>Maybe later</Button>
          </section>
        </div>
      )}
    </section>
  );
}
