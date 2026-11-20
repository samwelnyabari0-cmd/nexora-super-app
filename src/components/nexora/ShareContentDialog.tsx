import { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  isValidSharedContentReference,
  sharedContentLabel,
  type SharedContentReference,
} from "./shared-content";

type ShareableItem = {
  reference: SharedContentReference;
  caption: string | null;
  createdAt: string | null;
};

type ShareContentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (reference: SharedContentReference) => Promise<boolean>;
};

export function ShareContentDialog({ open, onOpenChange, onShare }: ShareContentDialogProps) {
  const [items, setItems] = useState<ShareableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sharingId, setSharingId] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const [postsResult, mediaResult] = await Promise.all([
        (supabase as any)
          .from("posts")
          .select("id, caption, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        (supabase as any)
          .from("user_media_posts")
          .select("id, caption, content_type, created_at")
          .in("content_type", ["post", "reel", "video"])
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (cancelled) return;
      const rows: ShareableItem[] = [];
      for (const row of postsResult.data ?? []) {
        const reference = { source: "posts", contentId: row.id, contentType: "post" } as const;
        if (isValidSharedContentReference(reference)) {
          rows.push({ reference, caption: row.caption ?? null, createdAt: row.created_at ?? null });
        }
      }
      for (const row of mediaResult.data ?? []) {
        const reference = {
          source: "user_media_posts",
          contentId: row.id,
          contentType: row.content_type,
        };
        if (isValidSharedContentReference(reference)) {
          rows.push({ reference, caption: row.caption ?? null, createdAt: row.created_at ?? null });
        }
      }
      rows.sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
      setItems(rows);
      if (postsResult.error && mediaResult.error) {
        setError("Your shareable content could not be loaded.");
      } else if (postsResult.error || mediaResult.error) {
        setError("Some content could not be loaded. You can still share the items shown.");
      }
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError("Your shareable content could not be loaded.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open]);

  async function share(reference: SharedContentReference) {
    setSharingId(reference.contentId);
    try {
      const sent = await onShare(reference);
      if (sent) onOpenChange(false);
      else setError("This content could not be shared. Please try again.");
    } catch {
      setError("This content could not be shared. Please try again.");
    } finally {
      setSharingId("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Nexora content</DialogTitle>
          <DialogDescription>Choose a Post, Reel or Video you can currently access. The recipient will see it only if they still have permission to view it.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading content…</div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={`${item.reference.source}:${item.reference.contentId}`} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Share2 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{sharedContentLabel(item.reference.contentType)}</span>
                  <span className="block truncate text-sm text-muted-foreground">{item.caption || "Untitled content"}</span>
                </span>
                <Button type="button" size="sm" disabled={Boolean(sharingId)} onClick={() => void share(item.reference)}>
                  {sharingId === item.reference.contentId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No shareable Posts, Reels or Videos were found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
