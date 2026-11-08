import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FolderPlus, Trash2 } from "lucide-react";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { PostCard } from "@/components/nexora/PostCard";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { savedIds } from "@/features/core/tools";
export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved collections — NEXORA" },
      { name: "description", content: "Organize saved posts into session collections." },
      { property: "og:title", content: "Saved collections — NEXORA" },
      { property: "og:description", content: "Organize saved posts into session collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Saved,
});
function Saved() {
  const { posts, saved } = useApp();
  const { collections, addCollection, removeCollection, collect } = useWorkspace();
  const [active, setActive] = useState("All saved");
  const [name, setName] = useState("");
  const all = savedIds(saved, collections);
  const shown = posts.filter((p) =>
    active === "All saved" ? all.has(p.id) : collections[active]?.includes(p.id),
  );
  return (
    <div>
      <PageHeader title="Saved collections" action={<DemoBadge>Session only</DemoBadge>} />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addCollection(name);
          setName("");
        }}
      >
        <input
          aria-label="Collection name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection"
          className="min-w-0 flex-1 rounded-lg border bg-card px-3"
        />
        <Button disabled={!name.trim()}>
          <FolderPlus />
          Create
        </Button>
      </form>
      <div className="mb-5 flex flex-wrap gap-2">
        {["All saved", ...Object.keys(collections)].map((n) => (
          <Button
            key={n}
            variant={active === n ? "default" : "outline"}
            onClick={() => setActive(n)}
          >
            {n}
          </Button>
        ))}
        {active !== "All saved" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete collection"
            onClick={() => {
              removeCollection(active);
              setActive("All saved");
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {shown.map((p) => (
          <div key={p.id} className="min-w-0 space-y-2">
            <PostCard post={p} />
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Add to collection
              <select
                aria-label={`Collection for ${p.caption}`}
                value=""
                onChange={(e) => collect(e.target.value, p.id)}
                className="rounded-lg border bg-card p-2"
              >
                <option value="" disabled>
                  Choose collection
                </option>
                {Object.keys(collections).map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {collections[n].includes(p.id) ? " (remove)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      {!shown.length && (
        <p className="py-12 text-center text-muted-foreground">No posts in this collection.</p>
      )}
    </div>
  );
}
