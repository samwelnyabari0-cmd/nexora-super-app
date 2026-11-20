import { act, renderHook, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatLockStorageKey } from "@/components/nexora/chat-lock";
import { useChatLock } from "./useChatLock";

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto as unknown as Crypto);
  localStorage.clear();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("useChatLock", () => {
  it("locks before content is opened, verifies the passphrase, and recovers without deleting messages", async () => {
    const { result } = renderHook(() => useChatLock("user-1", "direct", "chat-1"));

    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    await act(async () => {
      await expect(result.current.create("private device phrase")).resolves.toBe(true);
    });
    expect(result.current.status).toBe("locked");
    expect(result.current.configured).toBe(true);

    const stored = localStorage.getItem(chatLockStorageKey("user-1", "direct", "chat-1"));
    expect(stored).not.toContain("private device phrase");

    await act(async () => {
      await expect(result.current.unlock("incorrect phrase")).resolves.toBe(false);
    });
    expect(result.current.status).toBe("locked");

    await act(async () => {
      await expect(result.current.unlock("private device phrase")).resolves.toBe(true);
    });
    expect(result.current.status).toBe("unlocked");

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.status).toBe("locked");

    await act(async () => {
      await expect(result.current.unlock("private device phrase")).resolves.toBe(true);
    });
    expect(result.current.status).toBe("unlocked");

    act(() => result.current.lockNow());
    expect(result.current.status).toBe("locked");

    act(() => result.current.reset());
    expect(result.current.status).toBe("unlocked");
    expect(result.current.configured).toBe(false);
    expect(localStorage.getItem(chatLockStorageKey("user-1", "direct", "chat-1"))).toBeNull();
  });
});
