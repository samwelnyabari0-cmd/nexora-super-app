import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallSession, type CallInvite } from "./CallSession";

const mocks = vi.hoisted(() => ({
  getUserMedia: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("peerjs", () => ({
  default: class MockPeer {
    on = vi.fn();
    destroy = vi.fn();
  },
}));

const incomingCall: CallInvite = {
  id: "call-1",
  caller: "caller-1",
  callee: "recipient-1",
  kind: "audio",
  status: "ringing",
  callee_peer_id: null,
};

describe("CallSession incoming media consent", () => {
  let previousMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    previousMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: mocks.getUserMedia },
    });
    mocks.getUserMedia.mockResolvedValue({
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { status: "ringing" }, error: null }),
    };
    mocks.from.mockReturnValue(query);
  });

  afterEach(() => {
    if (previousMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: previousMediaDevices,
      });
    }
  });

  it("requests microphone access only after the recipient explicitly accepts", async () => {
    render(
      <CallSession
        invite={incomingCall}
        userId="recipient-1"
        other={{ id: "caller-1", display_name: "Caller", handle: "caller" }}
      />,
    );

    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => {
      expect(mocks.getUserMedia).toHaveBeenCalledTimes(1);
      expect(mocks.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });
  });
});
