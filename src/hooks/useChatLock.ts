import { useCallback, useEffect, useRef, useState } from "react";
import {
  chatLockStorageKey,
  createDeviceLockRecord,
  parseDeviceLockRecord,
  verifyDeviceLockCode,
  type ChatLockKind,
  type DeviceChatLockRecord,
} from "@/components/nexora/chat-lock";

export type ChatLockStatus = "checking" | "unlocked" | "locked";

type ChatLockSnapshot = {
  key: string;
  record: DeviceChatLockRecord | null;
  status: ChatLockStatus;
};

export type ChatLockState = {
  status: ChatLockStatus;
  configured: boolean;
  error: string;
  create: (code: string) => Promise<boolean>;
  unlock: (code: string) => Promise<boolean>;
  lockNow: () => void;
  beginAttachmentPicker: () => void;
  endAttachmentPicker: () => void;
  reset: () => void;
};

export function useChatLock(userId: string, chatKind: ChatLockKind, chatId: string): ChatLockState {
  const key = userId && chatId ? chatLockStorageKey(userId, chatKind, chatId) : "";
  const [snapshot, setSnapshot] = useState<ChatLockSnapshot>({
    key: "",
    record: null,
    status: "checking",
  });
  const [error, setError] = useState("");
  const skipVisibilityLockUntil = useRef(0);

  const current = snapshot.key === key && key
    ? snapshot
    : { key, record: null, status: key ? "checking" as const : "unlocked" as const };
  const status = current.status;
  const record = current.record;

  useEffect(() => {
    if (!key) {
      setSnapshot({ key: "", record: null, status: "unlocked" });
      setError("");
      return;
    }
    try {
      const stored = parseDeviceLockRecord(localStorage.getItem(key));
      setSnapshot({ key, record: stored, status: stored ? "locked" : "unlocked" });
      setError("");
    } catch {
      setSnapshot({ key, record: null, status: "unlocked" });
      setError("This browser cannot access local storage, so a device lock cannot be saved.");
    }
  }, [key]);

  const create = useCallback(async (code: string) => {
    if (!key) return false;
    try {
      const nextRecord = await createDeviceLockRecord(code);
      localStorage.setItem(key, JSON.stringify(nextRecord));
      setSnapshot({ key, record: nextRecord, status: "locked" });
      setError("");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The local chat lock could not be created.");
      return false;
    }
  }, [key]);

  const unlock = useCallback(async (code: string) => {
    if (!key || !record) return false;
    const valid = await verifyDeviceLockCode(code, record);
    if (!valid) {
      setError("That passphrase is not correct.");
      return false;
    }
    setSnapshot({ key, record, status: "unlocked" });
    setError("");
    return true;
  }, [key, record]);

  const lockNow = useCallback(() => {
    if (key && record) {
      setSnapshot({ key, record, status: "locked" });
      setError("");
    }
  }, [key, record]);

  const beginAttachmentPicker = useCallback(() => {
    // Android may background the browser while the system picker is open.
    // Keep the chat unlocked until the picker returns and the caller ends the
    // selection flow; the timeout also recovers if the picker is cancelled.
    skipVisibilityLockUntil.current = Date.now() + 90_000;
  }, []);

  const endAttachmentPicker = useCallback(() => {
    skipVisibilityLockUntil.current = 0;
  }, []);

  useEffect(() => {
    if (status !== "unlocked" || !record) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (Date.now() < skipVisibilityLockUntil.current) return;
        lockNow();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, record, lockNow]);

  const reset = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
      setSnapshot({ key, record: null, status: "unlocked" });
      setError("");
    } catch {
      setError("The local lock could not be reset in this browser.");
    }
  }, [key]);

  return {
    status,
    configured: Boolean(record),
    error,
    create,
    unlock,
    lockNow,
    beginAttachmentPicker,
    endAttachmentPicker,
    reset,
  };
}
