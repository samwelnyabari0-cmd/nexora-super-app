import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMMUTE_CACHE,
  clearCommutePack,
  formatOfflineBytes,
  listCommutePack,
  removeCommuteMedia,
  type CommuteMediaItem,
} from "@/lib/offline-storage";

type PreviewItem = CommuteMediaItem & { previewUrl?: string; thumbnailPreviewUrl?: string };

export function OfflinePackManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes + item.thumbnailSizeBytes, 0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const createdUrls: string[] = [];
    try {
      const stored = await listCommutePack();
      const cache = await caches.open(COMMUTE_CACHE);
      const hydrated = await Promise.all(stored.map(async (item) => {
        const response = await cache.match(item.offlineUrl);
        const thumbnailResponse = item.offlineThumbnailUrl
          ? await cache.match(item.offlineThumbnailUrl)
          : undefined;
        const previewUrl = response ? URL.createObjectURL(await response.blob()) : undefined;
        const thumbnailPreviewUrl = thumbnailResponse ? URL.createObjectURL(await thumbnailResponse.blob()) : undefined;
        if (previewUrl) createdUrls.push(previewUrl);
        if (thumbnailPreviewUrl) createdUrls.push(thumbnailPreviewUrl);
        return { ...item, previewUrl, thumbnailPreviewUrl };
      }));
      setItems((previous) => {
        previous.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (item.thumbnailPreviewUrl) URL.revokeObjectURL(item.thumbnailPreviewUrl);
        });
        return hydrated;
      });
    } catch (reason) {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
      setError(reason instanceof Error ? reason.message : "Your offline pack could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    const handleUpdate = () => {
      if (open) void refresh();
    };
    window.addEventListener("nexora:offline-pack-updated", handleUpdate);
    return () => window.removeEventListener("nexora:offline-pack-updated", handleUpdate);
  }, [open, refresh]);

  useEffect(() => () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.thumbnailPreviewUrl) URL.revokeObjectURL(item.thumbnailPreviewUrl);
    });
  }, [items]);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await removeCommuteMedia(id);
      await refresh();
      window.dispatchEvent(new Event("nexora:offline-pack-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove this item.");
    } finally {
      setBusyId("");
    }
  }

  async function clearAll() {
    if (!window.confirm("Remove every downloaded item from this device?")) return;
    setBusyId("all");
    try {
      await clearCommutePack();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not clear your offline pack.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="fixed bottom-24 right-3 z-[75] gap-2 rounded-full border shadow-lg md:bottom-5 md:right-5"
        onClick={() => setOpen(true)}
        aria-label={"Open offline pack, " + items.length + " saved items"}
      >
        <Download className="h-4 w-4" />
        Offline Pack
        {items.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{items.length}</span>}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="offline-pack-title" className="max-h-[88svh] w-full max-w-2xl overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl">
            <header className="flex items-center gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <h2 id="offline-pack-title" className="font-display text-lg font-bold">Daily Commute Pack</h2>
                <p className="text-xs text-muted-foreground">{items.length} of 15 items · {formatOfflineBytes(totalBytes)} of 150 MB used</p>
              </div>
              {items.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => void clearAll()} disabled={busyId !== ""}><Trash2 className="mr-1 h-4 w-4" /> Clear all</Button>}
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close offline pack"><X /></Button>
            </header>
            <div className="max-h-[calc(88svh-76px)] space-y-3 overflow-y-auto p-4">
              <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                Saved media stays on this device. Download over Wi-Fi when possible; your pack is capped at 150 MB.
              </div>
              {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading your offline items…</p> :
                items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nothing saved yet. Open a Reel or Video and choose Save offline.</p> :
                  items.map((item) => (
                    <article key={item.id} className="flex gap-3 rounded-xl border p-3">
                      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-black">
                        {item.mediaType === "video" && item.previewUrl
                          ? <video src={item.previewUrl} poster={item.thumbnailPreviewUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                          : item.previewUrl
                            ? <a href={item.previewUrl} target="_blank" rel="noreferrer" className="grid h-full place-items-center text-xs text-white">Open saved file</a>
                            : <div className="grid h-full place-items-center text-xs text-white">File missing</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-semibold">{item.title || "NEXORA media"}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.contentType === "reel" ? "Reel" : item.contentType === "lesson" ? "Study material" : "Video"} · {formatOfflineBytes(item.sizeBytes)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Saved {new Date(item.savedAt).toLocaleDateString()}</p>
                        <Button type="button" size="sm" variant="ghost" className="mt-1 h-8 px-2 text-destructive" disabled={busyId !== ""} onClick={() => void remove(item.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Remove</Button>
                      </div>
                    </article>
                  ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
