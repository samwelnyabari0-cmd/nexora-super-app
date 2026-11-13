import { useState } from "react";
import { Clapperboard, Image, GalleryHorizontal, Film, Timer, Radio, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CONTENT_TYPES, type ContentType } from "@/lib/post-types";
import { cn } from "@/lib/utils";

const ICONS = {
  reel: Clapperboard,
  post: Image,
  carousel: GalleryHorizontal,
  video: Film,
  story: Timer,
  live: Radio,
  ad: Megaphone,
} as const;

export function ContentTypePicker({
  value,
  onSelect,
}: {
  value: ContentType;
  onSelect: (type: ContentType) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = CONTENT_TYPES.find((c) => c.id === value) ?? CONTENT_TYPES[1];
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-label="Choose what to create">
        <Plus className="mr-2 h-4 w-4" /> Create: {current.label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Create</DialogTitle>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {CONTENT_TYPES.map((c) => {
              const Icon = ICONS[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelect(c.id);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center",
                    c.id === value && "border-primary bg-primary/10",
                    c.id === "live" && "text-destructive",
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-semibold">{c.label}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">{c.hint}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
