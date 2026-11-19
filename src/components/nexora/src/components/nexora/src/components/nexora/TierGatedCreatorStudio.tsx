
import { Lock, Sparkles, Scissors, Volume2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  userPlan: "free" | "pro" | "studio";
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  filterIntensity: number;
  onFilterIntensityChange: (value: number) => void;
  onNavigateToSubscriptions: () => void;
};

export default function TierGatedCreatorStudio({
  userPlan,
  selectedFilter,
  onFilterChange,
  filterIntensity,
  onFilterIntensityChange,
  onNavigateToSubscriptions,
}: Props) {
  const isPro = userPlan === "pro" || userPlan === "studio";
  const isStudio = userPlan === "studio";

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">
            Active plan
          </p>
          <p className="flex items-center gap-1.5 text-sm font-bold capitalize text-primary">
            {userPlan} plan
            {isStudio && <Sparkles className="h-4 w-4" />}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline"
          onClick={onNavigateToSubscriptions}>
          Manage plans
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Color treatment</h2>
        <div className="flex flex-wrap gap-2">
          {["original", "vivid", "mono", "cinema", "soft"].map((filter) => (
            <Button key={filter} type="button" size="sm"
              variant={selectedFilter === filter ? "default" : "outline"}
              className="capitalize"
              onClick={() => onFilterChange(filter)}>
              {filter}
            </Button>
          ))}
        </div>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2 flex justify-between text-xs">
            <span className="flex items-center gap-1">
              Filter intensity
              {!isPro && <Lock className="h-3 w-3 text-amber-500" />}
            </span>
            <span>{filterIntensity}%</span>
          </div>
          {isPro ? (
            <input type="range" min="0" max="100"
              aria-label="Filter intensity"
              value={filterIntensity}
              onChange={(e) =>
                onFilterIntensityChange(Number(e.target.value))
              }
              className="w-full accent-primary" />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Upgrade to Pro to adjust filter strength.
              </p>
              <Button type="button" size="sm" variant="link"
                onClick={onNavigateToSubscriptions}>
                Unlock Pro
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Audio</h2>
        <p className="text-xs text-muted-foreground">
          Add your own background track and record a voiceover in the Advanced
          Studio Editor below. The Nexora licensed music catalogue is not
          connected yet.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            Advanced Studio Suite
          </span>
          {!isStudio && (
            <span className="rounded-full border px-2 py-0.5 text-[10px]">
              STUDIO TIER
            </span>
          )}
        </div>

        {isStudio ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <Scissors className="h-4 w-4" />
              Trim timeline
              <span className="ml-auto text-muted-foreground">
                Open the editor below
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <Volume2 className="h-4 w-4" />
              Voiceover & audio mix
              <span className="ml-auto text-muted-foreground">
                Available in editor below
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <Type className="h-4 w-4" />
              Custom branding overlay
              <span className="ml-auto text-muted-foreground">
                Integration pending
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-xs text-muted-foreground">
              Unlock timeline editing, voiceover and custom branding with Studio.
            </p>
            <Button type="button" size="sm" className="w-full"
              onClick={onNavigateToSubscriptions}>
              Upgrade to Studio · $24.99/month
            </Button>
          </div>
        )}
      </div>
    </section>
  );
              }
