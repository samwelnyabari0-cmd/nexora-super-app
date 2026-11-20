import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { DisappearingSettingsControl } from "./DisappearingSettingsControl";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = (supabase as any).rpc as ReturnType<typeof vi.fn>;

describe("DisappearingSettingsControl", () => {
  beforeEach(() => rpc.mockReset());

  it("recovers from a rejected save instead of remaining stuck", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ retention_seconds: 0 }],
        error: null,
      })
      .mockRejectedValueOnce(new Error("offline"));

    render(<DisappearingSettingsControl chatKind="direct" chatId="contact-a" />);
    const select = screen.getByLabelText("New message expiry") as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));

    fireEvent.change(select, { target: { value: "86400" } });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/could not be saved/i);
      expect(select.disabled).toBe(false);
    });
  });

  it("does not apply a previous chat's late save result after switching chats", async () => {
    let finishOldSave: ((value: { data: number; error: null }) => void) | undefined;
    const oldSave = new Promise<{ data: number; error: null }>((resolve) => {
      finishOldSave = resolve;
    });
    rpc
      .mockResolvedValueOnce({
        data: [{ retention_seconds: 0 }],
        error: null,
      })
      .mockImplementationOnce(() => oldSave)
      .mockResolvedValueOnce({
        data: [{ retention_seconds: 604800 }],
        error: null,
      });

    const { rerender } = render(
      <DisappearingSettingsControl chatKind="direct" chatId="contact-a" />,
    );
    const select = screen.getByLabelText("New message expiry") as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));
    fireEvent.change(select, { target: { value: "86400" } });

    rerender(
      <DisappearingSettingsControl chatKind="direct" chatId="contact-b" />,
    );
    await waitFor(() => expect(select.value).toBe("604800"));

    finishOldSave?.({ data: 86400, error: null });
    await waitFor(() => expect(select.value).toBe("604800"));
  });
});
