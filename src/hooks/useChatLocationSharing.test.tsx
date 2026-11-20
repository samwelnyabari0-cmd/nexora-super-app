import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatLocationSharing } from "./useChatLocationSharing";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => ({
      send: vi.fn(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn(async (name: string) => ({
      data: name === "start_chat_location_share" ? "session-123" : true,
      error: null,
    })),
  },
}));

describe("useChatLocationSharing lifecycle", () => {
  const clearWatch = vi.fn();
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({
      coords: {
        latitude: -1.2864,
        longitude: 36.8172,
        accuracy: 10,
      } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);
  });
  const watchPosition = vi.fn(() => 77);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition, watchPosition, clearWatch },
    });
  });

  it("stops the previous live session and clears its watch when the chat changes", async () => {
    const { result, rerender } = renderHook(
      ({ chatId }: { chatId: string }) =>
        useChatLocationSharing({
          chatKind: "direct",
          chatId,
          userId: "sender-123",
          enabled: true,
          onShareOnce: async () => true,
          onLiveSession: async () => true,
        }),
      { initialProps: { chatId: "recipient-a" } },
    );

    await act(async () => {
      await result.current.startLiveSharing(15);
    });

    expect(result.current.activeSessionId).toBe("session-123");
    expect(watchPosition).toHaveBeenCalledOnce();

    rerender({ chatId: "recipient-b" });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "stop_chat_location_share",
        { p_session_id: "session-123" },
      );
    });
    expect(clearWatch).toHaveBeenCalledWith(77);
  });
});
