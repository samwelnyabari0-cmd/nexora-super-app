import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  chatLockStorageKey,
  constantTimeStringEqual,
  isValidDeviceLockCode,
  createDeviceLockRecord,
  parseDeviceLockRecord,
  verifyDeviceLockCode,
} from "./chat-lock";

beforeEach(() => vi.stubGlobal("crypto", webcrypto as unknown as Crypto));
afterEach(() => vi.unstubAllGlobals());

describe("per-device chat lock helpers", () => {
  it("requires a non-whitespace code between 8 and 32 characters", () => {
    expect(isValidDeviceLockCode("short")).toBe(false);
    expect(isValidDeviceLockCode("        ")).toBe(false);
    expect(isValidDeviceLockCode("a secure phrase")).toBe(true);
    expect(isValidDeviceLockCode("a".repeat(33))).toBe(false);
  });

  it("scopes lock data to the signed-in user, chat kind and chat id", () => {
    expect(chatLockStorageKey("user-1", "direct", "chat-1"))
      .not.toBe(chatLockStorageKey("user-2", "direct", "chat-1"));
    expect(chatLockStorageKey("user-1", "direct", "chat-1"))
      .not.toBe(chatLockStorageKey("user-1", "group", "chat-1"));
  });

  it("stores a salted verifier rather than the plaintext passphrase", async () => {
    const passphrase = "private device phrase";
    const record = await createDeviceLockRecord(passphrase);
    expect(JSON.stringify(record)).not.toContain(passphrase);
    expect(parseDeviceLockRecord(JSON.stringify(record))).toEqual(record);
    await expect(verifyDeviceLockCode(passphrase, record)).resolves.toBe(true);
    await expect(verifyDeviceLockCode("wrong passphrase", record)).resolves.toBe(false);
  });

  it("rejects malformed verifier records", () => {
    expect(parseDeviceLockRecord("not-json")).toBeNull();
    expect(parseDeviceLockRecord(JSON.stringify({ version: 1, salt: "x", verifier: "x", iterations: 120000 }))).toBeNull();
  });

  it("compares verifier strings without early exit on differing characters", () => {
    expect(constantTimeStringEqual("abcdef", "abcdef")).toBe(true);
    expect(constantTimeStringEqual("abcdef", "abcdeg")).toBe(false);
    expect(constantTimeStringEqual("abc", "abcd")).toBe(false);
  });
});
