import { useCallback, useEffect, useState } from "react";
import {
  chatLockStorageKey,
  constantTimeStringEqual,
  isValidDeviceLockCode,
  type ChatLockKind,
} from "@/components/nexora/chat-lock";

type StoredDeviceLock = {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
};

const PBKDF2_ITERATIONS = 250_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveVerifier(code: string, salt: Uint8Array, iterations: number): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Device lock requires a secure browser context.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export function useChatDeviceLock(userId: string, chatKind: ChatLockKind, chatId: string) {
  const storageKey = userId && chatId ? chatLockStorageKey(userId, chatKind, chatId) : "";
  const [readyKey, setReadyKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const ready = !storageKey || readyKey === storageKey;

  useEffect(() => {
    if (!storageKey) {
      setConfigured(false);
      setLocked(false);
      setReadyKey("");
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      setConfigured(Boolean(stored));
      setLocked(Boolean(stored));
      setError("");
    } catch {
      setConfigured(false);
      setLocked(false);
      setError("This browser could not access device lock storage.");
    }
    setReadyKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || !configured || locked) return;
    const lockOnHide = () => {
      if (document.visibilityState === "hidden") setLocked(true);
    };
    document.addEventListener("visibilitychange", lockOnHide);
    return () => document.removeEventListener("visibilitychange", lockOnHide);
  }, [configured, locked, ready]);

  const setLockCode = useCallback(async (code: string) => {
    if (!storageKey) return false;
    if (!isValidDeviceLockCode(code)) {
      setError("Use a device lock code between 8 and 32 characters.");
      return false;
    }
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await deriveVerifier(code, salt, PBKDF2_ITERATIONS);
      const stored: StoredDeviceLock = {
        version: 1,
        salt: toBase64(salt),
        hash,
        iterations: PBKDF2_ITERATIONS,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
      setConfigured(true);
      setLocked(false);
      setError("");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Device lock could not be saved.");
      return false;
    }
  }, [storageKey]);

  const unlock = useCallback(async (code: string) => {
    if (!storageKey) return false;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setConfigured(false);
        setLocked(false);
        setError("No device lock is configured for this chat.");
        return false;
      }
      const stored = JSON.parse(raw) as StoredDeviceLock;
      if (stored.version !== 1 || !stored.salt || !stored.hash
        || !Number.isInteger(stored.iterations) || stored.iterations < 100_000 || stored.iterations > 1_000_000) {
        throw new Error("Stored device lock data is invalid. Reset this device's lock to continue.");
      }
      const candidate = await deriveVerifier(code, fromBase64(stored.salt), stored.iterations);
      if (!constantTimeStringEqual(candidate, stored.hash)) {
        setError("That device lock code is not correct.");
        return false;
      }
      setLocked(false);
      setError("");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This chat could not be unlocked.");
      return false;
    }
  }, [storageKey]);

  const lock = useCallback(() => {
    if (configured) setLocked(true);
  }, [configured]);

  const reset = useCallback(() => {
    if (!storageKey) return;
    try {
      window.localStorage.removeItem(storageKey);
      setConfigured(false);
      setLocked(false);
      setError("");
    } catch {
      setError("The device lock could not be reset.");
    }
  }, [storageKey]);

  return {
    ready,
    configured,
    locked,
    error,
    setLockCode,
    unlock,
    lock,
    reset,
    clearError: () => setError(""),
  };
}
