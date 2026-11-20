import { describe, expect, it } from "vitest";
import {
  chatLockStorageKey,
  constantTimeStringEqual,
  isValidDeviceLockCode,
} from "./chat-lock";

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

  it("compares verifier strings without early exit on differing characters", () => {
    expect(constantTimeStringEqual("abcdef", "abcdef")).toBe(true);
    expect(constantTimeStringEqual("abcdef", "abcdeg")).toBe(false);
    expect(constantTimeStringEqual("abc", "abcd")).toBe(false);
  });
});
