import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
import { catalog } from "@/features/core/data";
import { Chip, DemoBadge, PageHeader } from "@/components/nexora/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Watch — NEXORA" },
      { name: "description", content: "Demo streaming catalogue of series, films and live." },
      { property: "og:title", content: "Watch — NEXORA" },
      { property: "og:description", content: "Demo streaming catalogue." },
    ],
  }),
  component: Watch,
});

function Watch() {
  const [g, setG] = useState("All");
  const genres = ["All", ...new Set(catalog.map((c) => c.genre))];
  const hero = catalog[0];
  const list = catalog.filter((c) => g === "All" || c.genre === g);
  return (
    <div>
      <PageHeader title="Watch" action={<DemoBadge>Demo catalogue</DemoBadge>} />
      <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-3xl md:aspect-[21/9]">
        <img src={hero.image} alt="" className="h-full w-full object-cover" />
        <div className="bg-scrim absolute inset-0" />
        <div className="absolute bottom-5 left-5">
          <p className="text-xs uppercase tracking-widest text-accent">Featured</p>
          <h2 className="text-3xl font-bold md:text-5xl">{hero.title}</h2>
          <button
            onClick={() => toast("Playback is simulated in this demo")}
            className="mt-3 flex items-center gap-2 rounded-full bg-foreground px-5 py-2 font-semibold text-background"
          >
            <Play className="h-4 w-4 fill-current" /> Play
          </button>
        </div>
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {genres.map((x) => (
          <Chip key={x} active={g === x} onClick={() => setG(x)}>
            {x}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => toast(`"${t.title}" — playback simulated`)}
            className="group text-left"
          >
            <div className="relative aspect-video overflow-hidden rounded-2xl">
              <img
                src={t.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              {t.live && (
                <span className="absolute left-2 top-2 rounded bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                  LIVE
                </span>
              )}
              {t.progress && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <span className="bg-brand block h-full" style={{ width: `${t.progress}%` }} />
                </span>
              )}
            </div>
            <p className="mt-2 font-semibold">{t.title}</p>
            <p className="text-xs text-muted-foreground">
              {t.genre} · {t.year} · {t.length}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
