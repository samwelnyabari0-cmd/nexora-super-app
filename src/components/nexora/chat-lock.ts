export type ChatLockKind = "direct" | "group";

export function isValidDeviceLockCode(code: string): boolean {
  return code.length >= 8 && code.length <= 32 && !/^\s+$/.test(code);
}

export function chatLockStorageKey(userId: string, chatKind: ChatLockKind, chatId: string): string {
  return `nexora:chat-lock:v1:${encodeURIComponent(userId)}:${chatKind}:${encodeURIComponent(chatId)}`;
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export type DeviceChatLockRecord = {
  version: 1;
  salt: string;
  verifier: string;
  iterations: number;
};

const LOCK_ITERATIONS = 120_000;

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveVerifier(code: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    256,
  );
  return encodeBytes(new Uint8Array(bits));
}

export async function createDeviceLockRecord(code: string): Promise<DeviceChatLockRecord> {
  if (!isValidDeviceLockCode(code)) throw new Error("Use a private passphrase between 8 and 32 characters.");
  if (!globalThis.crypto?.subtle) throw new Error("Secure local lock is not supported by this browser.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    version: 1,
    salt: encodeBytes(salt),
    verifier: await deriveVerifier(code, salt, LOCK_ITERATIONS),
    iterations: LOCK_ITERATIONS,
  };
}

export function parseDeviceLockRecord(value: string | null): DeviceChatLockRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DeviceChatLockRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.salt !== "string" ||
      typeof parsed.verifier !== "string" ||
      !Number.isInteger(parsed.iterations) ||
      (parsed.iterations ?? 0) < 100_000 ||
      (parsed.iterations ?? 0) > 500_000
    ) return null;
    if (decodeBytes(parsed.salt).length !== 16 || decodeBytes(parsed.verifier).length !== 32) return null;
    return {
      version: 1,
      salt: parsed.salt,
      verifier: parsed.verifier,
      iterations: parsed.iterations!,
    };
  } catch {
    return null;
  }
}

export async function verifyDeviceLockCode(code: string, record: DeviceChatLockRecord): Promise<boolean> {
  if (!isValidDeviceLockCode(code) || !globalThis.crypto?.subtle) return false;
  try {
    const candidate = await deriveVerifier(code, decodeBytes(record.salt), record.iterations);
    return constantTimeStringEqual(candidate, record.verifier);
  } catch {
    return false;
  }
}

export function hasStoredChatLock(userId: string, chatKind: ChatLockKind, chatId: string): boolean {
  if (typeof localStorage === "undefined" || !userId || !chatId) return false;
  try {
    return parseDeviceLockRecord(localStorage.getItem(chatLockStorageKey(userId, chatKind, chatId))) !== null;
  } catch {
    return false;
  }
}
