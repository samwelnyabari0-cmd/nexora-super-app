export type OfflineMessageKind = "direct" | "group";

export type OfflineMessage = {
  id: string;
  ownerId: string;
  kind: OfflineMessageKind;
  conversationId: string;
  body: string;
  createdAt: number;
  retries: number;
  lastError?: string;
};

export type CommuteMediaItem = {
  id: string;
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  mediaType: "video" | "audio" | "image" | "document";
  contentType: "reel" | "video" | "lesson";
  savedAt: number;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  offlineUrl: string;
  offlineThumbnailUrl?: string;
};

const DB_NAME = "nexora-offline-db";
const DB_VERSION = 1;
export const COMMUTE_CACHE = "nexora-commute-media-v1";
export const MAX_COMMUTE_PACK_BYTES = 150 * 1024 * 1024;
export const MAX_COMMUTE_ITEM_BYTES = 60 * 1024 * 1024;
export const MAX_COMMUTE_ITEMS = 15;

type OfflineDB = IDBDatabase;

function openOfflineDB(): Promise<OfflineDB> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Offline storage is not supported in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "id" });
        store.createIndex("by-owner-created", ["ownerId", "createdAt"]);
      }
      if (!db.objectStoreNames.contains("commute_pack")) {
        const store = db.createObjectStore("commute_pack", { keyPath: "id" });
        store.createIndex("by-savedAt", "savedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
    request.onblocked = () => reject(new Error("Offline storage is busy in another tab. Close other NEXORA tabs and retry."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function enqueueOfflineMessage(
  item: Omit<OfflineMessage, "createdAt" | "retries">,
): Promise<void> {
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("outbox", "readwrite");
    transaction.objectStore("outbox").put({
      ...item,
      createdAt: Date.now(),
      retries: 0,
    } satisfies OfflineMessage);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not save the queued message."));
    });
  } finally {
    db.close();
  }

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      await syncRegistration.sync?.register("nexora-outbox-sync");
    } catch {
      // The app's online event is the reliable fallback on browsers without Background Sync.
    }
  }
}

export async function getQueuedMessages(
  ownerId: string,
  kind?: OfflineMessageKind,
  conversationId?: string,
): Promise<OfflineMessage[]> {
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("outbox", "readonly");
    const items = await requestResult(transaction.objectStore("outbox").getAll()) as OfflineMessage[];
    return items
      .filter((item) => item.ownerId === ownerId)
      .filter((item) => !kind || item.kind === kind)
      .filter((item) => !conversationId || item.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function removeQueuedMessage(id: string): Promise<void> {
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("outbox", "readwrite");
    transaction.objectStore("outbox").delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not remove the sent message from offline storage."));
    });
  } finally {
    db.close();
  }
}

function mediaCacheUrl(id: string, asset: "media" | "thumbnail"): string {
  const safeId = encodeURIComponent(id);
  return new URL("/__nexora_offline__/" + safeId + "/" + asset, window.location.origin).toString();
}

export async function saveCommuteMedia(
  input: Omit<CommuteMediaItem, "savedAt" | "sizeBytes" | "thumbnailSizeBytes" | "offlineUrl" | "offlineThumbnailUrl">,
): Promise<{ item: CommuteMediaItem; totalBytes: number }> {
  if (!("caches" in window) || !navigator.onLine) {
    throw new Error("Connect to the internet before saving content for offline use.");
  }
  if (!input.mediaUrl || !/^https?:\/\//i.test(input.mediaUrl)) {
    throw new Error("This content does not have a downloadable media file.");
  }

  await requestPersistentStorage();
  const cache = await caches.open(COMMUTE_CACHE);
  const existing = await listCommutePack();
  const existingItem = existing.find((item) => item.id === input.id);
  const existingBytes = existing.reduce((total, item) => total + item.sizeBytes + item.thumbnailSizeBytes, 0);
  const mediaResponse = await fetch(input.mediaUrl, { mode: "cors", credentials: "omit" });
  if (!mediaResponse.ok) throw new Error("The media file could not be downloaded. It may have expired or be private.");
  const mediaBlob = await mediaResponse.blob();
  if (mediaBlob.size > MAX_COMMUTE_ITEM_BYTES) {
    throw new Error("This file is larger than the 60 MB offline item limit.");
  }

  let thumbnailBlob: Blob | null = null;
  if (input.thumbnailUrl) {
    try {
      const response = await fetch(input.thumbnailUrl, { mode: "cors", credentials: "omit" });
      if (response.ok) thumbnailBlob = await response.blob();
    } catch {
      // A thumbnail is optional; the media itself can still be saved.
    }
  }

  const nextBytes = existingBytes - (existingItem?.sizeBytes ?? 0) - (existingItem?.thumbnailSizeBytes ?? 0) + mediaBlob.size + (thumbnailBlob?.size ?? 0);
  const nextCount = existing.length + (existingItem ? 0 : 1);
  if (nextCount > MAX_COMMUTE_ITEMS) throw new Error("Your Commute Pack is full. Remove an item before adding another.");
  if (nextBytes > MAX_COMMUTE_PACK_BYTES) throw new Error("This would exceed the 150 MB Commute Pack limit. Remove an item or choose a smaller file.");

  const offlineUrl = mediaCacheUrl(input.id, "media");
  const offlineThumbnailUrl = thumbnailBlob ? mediaCacheUrl(input.id, "thumbnail") : undefined;
  await cache.put(offlineUrl, new Response(mediaBlob, {
    headers: { "Content-Type": mediaBlob.type || "application/octet-stream" },
  }));
  if (offlineThumbnailUrl && thumbnailBlob) {
    await cache.put(offlineThumbnailUrl, new Response(thumbnailBlob, {
      headers: { "Content-Type": thumbnailBlob.type || "image/jpeg" },
    }));
  }

  const item: CommuteMediaItem = {
    ...input,
    savedAt: Date.now(),
    sizeBytes: mediaBlob.size,
    thumbnailSizeBytes: thumbnailBlob?.size ?? 0,
    offlineUrl,
    offlineThumbnailUrl,
  };

  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("commute_pack", "readwrite");
    transaction.objectStore("commute_pack").put(item);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not save this item."));
    });
  } finally {
    db.close();
  }

  return { item, totalBytes: nextBytes };
}

export async function listCommutePack(): Promise<CommuteMediaItem[]> {
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("commute_pack", "readonly");
    const items = await requestResult(transaction.objectStore("commute_pack").getAll()) as CommuteMediaItem[];
    return items.sort((a, b) => b.savedAt - a.savedAt);
  } finally {
    db.close();
  }
}

export async function removeCommuteMedia(id: string): Promise<void> {
  const item = (await listCommutePack()).find((entry) => entry.id === id);
  if (item && "caches" in window) {
    const cache = await caches.open(COMMUTE_CACHE);
    await cache.delete(item.offlineUrl);
    if (item.offlineThumbnailUrl) await cache.delete(item.offlineThumbnailUrl);
  }
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("commute_pack", "readwrite");
    transaction.objectStore("commute_pack").delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not remove this offline item."));
    });
  } finally {
    db.close();
  }
}

export async function clearCommutePack(): Promise<void> {
  if ("caches" in window) await caches.delete(COMMUTE_CACHE);
  const db = await openOfflineDB();
  try {
    const transaction = db.transaction("commute_pack", "readwrite");
    transaction.objectStore("commute_pack").clear();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not clear the offline pack."));
    });
  } finally {
    db.close();
  }
}

export function formatOfflineBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
