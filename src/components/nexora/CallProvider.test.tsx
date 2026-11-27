import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallProvider } from "./CallProvider";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "recipient-1" }, ready: true }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock("./CallSession", () => ({
  CallSession: ({ invite }: { invite: { status: string } }) => (
    <div data-testid="global-call-session">Call status: {invite.status}</div>
  ),
}));

describe("CallProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{
          id: "call-1",
          caller: "caller-1",
          callee: "recipient-1",
          kind: "audio",
          status: "ringing",
          callee_peer_id: null,
          created_at: new Date().toISOString(),
        }],
        error: null,
      }),
    };
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    mocks.from.mockReturnValue(query);
    mocks.rpc.mockResolvedValue({
      data: [{ id: "caller-1", display_name: "Caller", handle: "caller" }],
      error: null,
    });
    mocks.channel.mockReturnValue(channel);
    mocks.removeChannel.mockResolvedValue(undefined);
  });

  it("shows fresh incoming calls over the current route without navigating away", async () => {
    render(
      <CallProvider>
        <main>Home feed remains open</main>
      </CallProvider>,
    );

    expect(screen.getByText("Home feed remains open")).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Incoming call" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("global-call-session")).toHaveTextContent("Call status: ringing");
    });
  });
  it("does not reopen an already accepted call after an app reload", async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{
        id: "call-accepted", caller: "caller-1", callee: "recipient-1",
        kind: "audio", status: "accepted", callee_peer_id: "peer-1",
        created_at: new Date().toISOString(),
      }], error: null }),
    });
    render(<CallProvider><main>Home feed remains open</main></CallProvider>);
    await waitFor(() => expect(mocks.from).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not interrupt the app with an expired ringing invitation", async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{
        id: "call-expired", caller: "caller-1", callee: "recipient-1",
        kind: "audio", status: "ringing", callee_peer_id: null,
        created_at: new Date(Date.now() - 120_000).toISOString(),
      }], error: null }),
    });
    render(<CallProvider><main>Home feed remains open</main></CallProvider>);
    await waitFor(() => expect(mocks.from).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

});
